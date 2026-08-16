import { createWorker, PSM } from "tesseract.js";

const AMOUNT_LABEL_PATTERN =
  /(?:monto\s+total|total\s+(?:de\s+)?efectivo|total\s+(?:de\s+)?depositado|deposito\s+total|monto\s+depositado|monto\s+enviado|\bmonto\b|\btotal\b|\bamount\b|\bimporte\b|\bpagado\b|\bvalor\b)/i;
const PRIMARY_RECEIPT_LABEL_PATTERN =
  /(?:comproba[nm]te|verificaci[o0]n)/i;
const SECONDARY_AMOUNT_PATTERN =
  /(?:impuesto|itbis|dgii|comisi[o0]n|\bcargo\b|\bfee\b|tarifa)/i;

const foldText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeOcrText = (text) =>
  String(text ?? "")
    .replace(/[S§]$/gm, "$")
    .replace(/\bO\b/g, "0")
    .replace(/(\d)[lI]/g, "$11")
    .replace(/\b[lI](\d)/g, "1$1")
    .replace(/¥/g, "$")
    .replace(/\bBMD\b/gi, "BHD")
    .replace(/\b8HD\b/gi, "BHD")
    .replace(/\bBH0\b/gi, "BHD")
    .replace(/RD[S§]\.?(?=\s*\d)/gi, "RD$")
    .replace(/SANTACRUZ/gi, "SANTA CRUZ")
    .replace(/DEPOS[IT1|l]{1,3}[0O]/gi, "DEPOSITO")
    .replace(/EFECT[IT1|l]{1,3}V[0O]/gi, "EFECTIVO");

const normalizeAmountValue = (rawValue) => {
  let clean = String(rawValue ?? "")
    .replace(/[OoQ]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[’'\s]/g, "")
    .replace(/[^\d.,]/g, "");

  if (!/\d/.test(clean)) return null;

  const lastDot = clean.lastIndexOf(".");
  const lastComma = clean.lastIndexOf(",");
  const lastSeparator = Math.max(lastDot, lastComma);

  if (lastSeparator >= 0) {
    const fractionalLength = clean.length - lastSeparator - 1;
    if (fractionalLength === 1 || fractionalLength === 2) {
      const integerPart = clean.slice(0, lastSeparator).replace(/[.,]/g, "");
      const decimalPart = clean.slice(lastSeparator + 1);
      clean = `${integerPart}.${decimalPart}`;
    } else {
      clean = clean.replace(/[.,]/g, "");
    }
  }

  const numericValue = Number(clean);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  return numericValue.toFixed(2);
};

const amountNeedsRetry = (result, expectedAmount) => {
  if (!result?.amount || result.requiresManualReview) return true;

  const normalizedExpected = normalizeAmountValue(expectedAmount);
  if (!normalizedExpected) return false;

  return normalizeAmountValue(result.amount) !== normalizedExpected;
};

const findLastPatternMatch = (value, pattern) => {
  const regex = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
  let lastMatch = null;
  for (const match of value.matchAll(regex)) lastMatch = match;
  return lastMatch;
};

const overlapsProtectedNumber = (line, start, end) => {
  const protectedPatterns = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g,
    /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\b/gi,
    /\b\d+(?:[.,]\d+)?\s*%/g,
  ];

  return protectedPatterns.some((pattern) =>
    [...line.matchAll(pattern)].some((match) => {
      const protectedStart = match.index ?? 0;
      const protectedEnd = protectedStart + match[0].length;
      return start < protectedEnd && end > protectedStart;
    }),
  );
};

const collectLayoutLines = (blocks, imageWidth, imageHeight) => {
  if (!Array.isArray(blocks) || !imageWidth || !imageHeight) return [];

  return blocks.flatMap((block) =>
    (block?.paragraphs ?? []).flatMap((paragraph) =>
      (paragraph?.lines ?? []).map((line) => {
        const bbox = line?.bbox ?? {};
        const centerX = ((bbox.x0 ?? 0) + (bbox.x1 ?? 0)) / 2 / imageWidth;
        const centerY = ((bbox.y0 ?? 0) + (bbox.y1 ?? 0)) / 2 / imageHeight;

        return {
          text: line?.text ?? "",
          confidence: line?.confidence ?? null,
          isLayout: true,
          isUpperCenter:
            centerY >= 0.08 &&
            centerY <= 0.42 &&
            centerX >= 0.25 &&
            centerX <= 0.75,
          position: centerY,
        };
      }),
    ),
  );
};

const buildAmountLines = (text, ocrContext) => {
  const plainLines = normalizeOcrText(text)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index, lines) => ({
      text: line,
      sourceGroup: "plainText",
      position: lines.length > 1 ? index / (lines.length - 1) : 0,
      isTextTop: index < Math.max(3, Math.ceil(lines.length * 0.35)),
    }));

  const layoutLines = collectLayoutLines(
    ocrContext?.blocks,
    ocrContext?.imageWidth,
    ocrContext?.imageHeight,
  ).map((line) => ({
    ...line,
    sourceGroup: "layout",
    text: normalizeOcrText(line.text),
  }));

  const focusedLines = normalizeOcrText(ocrContext?.focusedAmountText)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => ({
      text: line,
      sourceGroup: "focusedAmount",
      position: 0.2 + index * 0.01,
      isFocusedPrimaryRegion: true,
    }));

  return [...plainLines, ...layoutLines, ...focusedLines];
};

const detectAmountCandidate = (text, ocrContext = {}) => {
  const lines = buildAmountLines(text, ocrContext);
  const digitLike = "[0-9OoQIl|!Ss]";
  const groupedNumber = `${digitLike}{1,3}(?:[,.\\s]${digitLike}{3})+(?:[.,]${digitLike}{1,2})?`;
  const decimalNumber = `${digitLike}+(?:[.,]${digitLike}{1,2})`;
  const integerNumber = `${digitLike}+`;
  const currencyPrefix =
    "(?:\\b(?:D[O0]P|R[D0OQ](?:\\s*[$S§¥])?|U[S5]D|U[S5]\\s*[$S§¥]|S\\$)|[$¥])";
  const moneyPattern = new RegExp(
    `(?<![A-Za-z])(?:(${currencyPrefix})\\s*)?(${groupedNumber}|${decimalNumber}|${integerNumber})(?![A-Za-z])`,
    "gi",
  );
  const candidates = [];

  lines.forEach((line, lineIndex) => {
    const foldedLine = foldText(line.text);
    const priorLines = lines
      .slice(0, lineIndex)
      .filter((prior) => prior.sourceGroup === line.sourceGroup)
      .slice(-2)
      .reverse();

    for (const match of line.text.matchAll(moneyPattern)) {
      const currency = match[1] ?? "";
      const rawNumber = match[2] ?? "";
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const normalizedValue = normalizeAmountValue(rawNumber);
      if (!normalizedValue || overlapsProtectedNumber(line.text, start, end)) {
        continue;
      }

      const prefix = foldedLine.slice(0, start);
      const suffix = foldedLine.slice(end);
      const positiveMatch = findLastPatternMatch(prefix, AMOUNT_LABEL_PATTERN);
      const headerMatch = findLastPatternMatch(
        prefix,
        PRIMARY_RECEIPT_LABEL_PATTERN,
      );
      const negativeMatch = findLastPatternMatch(
        prefix,
        SECONDARY_AMOUNT_PATTERN,
      );
      const nearestPositiveIndex = Math.max(
        positiveMatch?.index ?? -1,
        headerMatch?.index ?? -1,
      );
      const negativeIsNearest =
        negativeMatch &&
        prefix.length - (negativeMatch.index ?? 0) <= 60 &&
        (nearestPositiveIndex < 0 ||
          (negativeMatch.index ?? -1) > nearestPositiveIndex);
      const negativePrecedingLine =
        !positiveMatch &&
        !headerMatch &&
        priorLines[0] &&
        SECONDARY_AMOUNT_PATTERN.test(foldText(priorLines[0].text));
      const negativeAfterStandaloneAmount =
        !prefix.trim() &&
        SECONDARY_AMOUNT_PATTERN.test(suffix.slice(0, 35));

      if (
        negativeIsNearest ||
        negativePrecedingLine ||
        negativeAfterStandaloneAmount
      ) {
        continue;
      }

      let positiveContext = positiveMatch || headerMatch ? "sameLine" : null;
      let contextType = headerMatch
        ? "receiptHeader"
        : positiveMatch
          ? "label"
          : null;

      if (!positiveContext) {
        const priorContextIndex = priorLines.findIndex((prior) => {
          const priorText = foldText(prior.text);
          return (
            AMOUNT_LABEL_PATTERN.test(priorText) ||
            PRIMARY_RECEIPT_LABEL_PATTERN.test(priorText)
          );
        });

        if (priorContextIndex >= 0) {
          positiveContext = `previousLine${priorContextIndex + 1}`;
          contextType = PRIMARY_RECEIPT_LABEL_PATTERN.test(
            foldText(priorLines[priorContextIndex].text),
          )
            ? "receiptHeader"
            : "label";
        }
      }

      const hasDecimal = /[.,][0-9OoQIl|!Ss]{1,2}$/.test(rawNumber.trim());
      const digitsOnly = rawNumber.replace(/\D/g, "");

      // Bare integers are usually dates, references or account fragments. They
      // only become monetary candidates when a currency/amount label anchors them.
      if (!currency && !hasDecimal && !positiveContext) continue;
      if (!currency && !hasDecimal && /^20\d{2}$/.test(digitsOnly)) continue;
      if (!currency && digitsOnly.length >= 7) continue;

      let score = 0;
      if (currency) score += 35;
      if (hasDecimal) score += 15;
      if (positiveContext === "sameLine") score += 75;
      if (positiveContext === "previousLine1") score += 65;
      if (positiveContext === "previousLine2") score += 45;
      if (contextType === "receiptHeader") score += 10;
      if (line.isUpperCenter) score += 40;
      if (line.isFocusedPrimaryRegion) score += 45;
      if (line.isTextTop) score += 25;
      if (line.confidence >= 70) score += 5;

      candidates.push({
        value: normalizedValue,
        raw: match[0].trim(),
        score,
        position: line.position ?? 1,
        hasCurrency: Boolean(currency),
        contextType,
        positiveContext,
        isUpperCenter: Boolean(line.isUpperCenter),
        isFocusedPrimaryRegion: Boolean(line.isFocusedPrimaryRegion),
      });
    }
  });

  const bestByValue = new Map();
  for (const candidate of candidates) {
    const previous = bestByValue.get(candidate.value);
    if (
      !previous ||
      candidate.score > previous.score ||
      (candidate.score === previous.score &&
        candidate.position < previous.position)
    ) {
      bestByValue.set(candidate.value, candidate);
    }
  }

  const ranked = [...bestByValue.values()];
  if (ranked.length === 1) ranked[0].score += 15;
  ranked.sort((a, b) => b.score - a.score || a.position - b.position);

  const best = ranked[0];
  if (!best || best.score < 55) {
    return {
      candidate: null,
      error: candidates.length ? "LOW_AMOUNT_CONFIDENCE" : "AMOUNT_NOT_FOUND",
    };
  }

  const runnerUp = ranked[1];
  const hasStrongPriority = Boolean(
    best.positiveContext || best.isUpperCenter || best.isFocusedPrimaryRegion,
  );
  if (runnerUp && best.score - runnerUp.score < 20 && !hasStrongPriority) {
    return { candidate: null, error: "AMBIGUOUS_AMOUNT" };
  }

  return { candidate: best, error: null };
};

// ── Friendly display names for each detected bank category ───────────────────
const BANK_DISPLAY_NAMES = {
  popular: "Banco Popular",
  banfondesa: "Banfondesa",
  reservas: "Banreservas",
  bhd: "BHD León",
  "santa cruz": "Banco Santa Cruz",
  scotiabank: "Scotiabank",
  promerica: "Promerica",
  "asociacion popular": "APAP",
  "asociacion cibao": "ACAP",
  "asociacion la nacional": "La Nacional",
  "asociacion bonao": "Asociación Bonao",
  "asociacion duarte": "Asociación Duarte",
  "asociacion la vega real": "La Vega Real",
  "asociacion maguana": "Asociación Maguana",
  "asociacion mocana": "Asociación Mocana",
  "asociacion peravia": "Asociación Peravia",
  "asociacion romana": "Asociación Romana",
  "banco adopem": "Banco Adopem",
  "banco agricola": "Banco Agrícola",
  "banco atlantico": "Banco Atlántico",
  "banco atlas": "Banco Atlas",
  banesco: "Banesco",
  qik: "Qik Banco",
  citibank: "Citibank",
  "banco multiple jmmb": "JMMB",
  "banco multiple lafise": "Lafise",
  "banco multiple ademi": "Ademi",
  "motor credito": "Motor Crédito",
};

/**
 * OCR Service to process bank receipts
 */
const ocrService = {
  /**
   * Processes an image and extracts bank details using a dynamic bank list
   * @param {string|File} image - Image to process
   * @param {Array} bankList - List of banks from the API [{id, name}]
   * @param {Array} currencyList - List of currencies from the API [{id, code, symbol}]
   * @param {Array} accountList - Valid origin accounts from the API
   * @param {number|string|null} expectedAmount - Optional amount used only to trigger focused OCR retries
   * @returns {Promise<Object>} JSON with bank, amount, description and currency
   */
  processReceipt: async (
    image,
    bankList = [],
    currencyList = [],
    accountList = [],
    expectedAmount = null,
  ) => {
    console.log("OCR: Starting process...");

    let processedImage = image;
    try {
      console.log("OCR: Preprocessing image...");
      processedImage = await ocrService.preprocessImage(image);
      console.log("OCR: Image preprocessed.");
    } catch (e) {
      console.warn("OCR: Preprocessing failed, using raw image", e);
    }

    const worker = await createWorker(["spa", "eng"]);
    console.log("OCR: Worker created successfully.");

    try {
      console.log("OCR: Starting recognition (this may take a few seconds)...");
      const { data: recognitionData } = await worker.recognize(
        processedImage,
        {},
        { text: true, blocks: true },
      );
      const { text, blocks } = recognitionData;
      console.log("OCR: Recognition finished.");
      console.log("--- OCR RAW TEXT START ---");
      console.log(text);
      console.log("--- OCR RAW TEXT END ---");

      let imageDimensions = null;
      try {
        imageDimensions = await ocrService.getImageDimensions(processedImage);
      } catch (dimensionError) {
        console.warn(
          "OCR: Could not read processed image dimensions",
          dimensionError,
        );
      }

      let ocrContext = {
        blocks,
        imageWidth: imageDimensions?.width,
        imageHeight: imageDimensions?.height,
      };
      let result = ocrService.parseReceiptText(
        text,
        bankList,
        currencyList,
        accountList,
        "",
        ocrContext,
      );

      // If the general pass did not produce a trustworthy amount, retry the
      // generic upper-center receipt region where banks usually render the
      // primary amount. The parser still applies the same exclusions and
      // ambiguity checks, so this hint cannot bypass validation.
      if (amountNeedsRetry(result, expectedAmount)) {
        try {
          const focusedAmountText =
            await ocrService.recognizePrimaryAmountRegion(
              worker,
              processedImage,
            );
          ocrContext = { ...ocrContext, focusedAmountText };
          result = ocrService.parseReceiptText(
            text,
            bankList,
            currencyList,
            accountList,
            "",
            ocrContext,
          );
        } catch (amountOcrError) {
          console.warn("OCR: Primary-amount retry failed", amountOcrError);
        }
      }

      // App Empresas places the amount around the middle of tall screenshots,
      // below the usual upper receipt header. Keep the existing retry intact
      // and use this lower crop only when it still did not find an amount.
      if (amountNeedsRetry(result, expectedAmount)) {
        try {
          const middleAmountText =
            await ocrService.recognizeMiddleAmountRegion(
              worker,
              processedImage,
            );
          ocrContext = {
            ...ocrContext,
            focusedAmountText: [
              ocrContext.focusedAmountText,
              middleAmountText,
            ]
              .filter(Boolean)
              .join("\n"),
          };
          result = ocrService.parseReceiptText(
            text,
            bankList,
            currencyList,
            accountList,
            "",
            ocrContext,
          );
        } catch (amountOcrError) {
          console.warn("OCR: Middle-amount retry failed", amountOcrError);
        }
      }

      // Popular renders the masked source account in light gray. The general
      // OCR pass can omit it entirely, so retry only that receipt region with
      // digit-only sparse-text recognition when the first pass has no account.
      if (
        !result.targetAccountSend &&
        result.detectedBankCategory === "popular" &&
        accountList.length > 0
      ) {
        try {
          const accountHintText =
            await ocrService.recognizePopularOriginAccount(
              worker,
              processedImage,
            );

          if (accountHintText) {
            console.log("OCR: Popular origin-account hint", accountHintText);
            result = ocrService.parseReceiptText(
              text,
              bankList,
              currencyList,
              accountList,
              accountHintText,
              ocrContext,
            );
          }
        } catch (accountOcrError) {
          console.warn(
            "OCR: Popular origin-account retry failed",
            accountOcrError,
          );
        }
      }

      await worker.terminate();
      console.log("--- OCR PARSED RESULT ---", result);

      return result;
    } catch (error) {
      console.error("OCR Error:", error);
      await worker.terminate();
      return {
        bank: null,
        amount: null,
        description: null,
        currency: null,
        error: error.message,
      };
    }
  },

  /**
   * Enhances image quality for OCR.
   * - For digital screenshots (high pixel density): minimal processing to avoid degradation.
   * - For photos of paper receipts (low resolution): grayscale + contrast boost.
   * @param {string|File} imageSrc - File object, Base64 or URL of the image
   */
  preprocessImage: async (imageSrc) => {
    let src = imageSrc;
    let tempUrl = null;
    if (imageSrc instanceof File || imageSrc instanceof Blob) {
      tempUrl = URL.createObjectURL(imageSrc);
      src = tempUrl;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (tempUrl) URL.revokeObjectURL(tempUrl);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Digital screenshots are already high-res — scaling them up hurts more than it helps.
        // Only scale small/low-res images (likely photos of paper receipts).
        const shortestSide = Math.min(img.width, img.height);
        const longestSide = Math.max(img.width, img.height);
        const isDigitalScreenshot = shortestSide >= 600 && longestSide >= 800;
        const scale = isDigitalScreenshot ? 1 : img.width < 1000 ? 2.5 : 1.5;

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        if (isDigitalScreenshot) {
          // Light processing: just draw the image as-is, max quality
          ctx.filter = "contrast(115%) brightness(102%)";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } else {
          // Heavy processing for low-res / paper photos
          ctx.filter = "grayscale(100%) contrast(145%) brightness(105%)";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.filter = "contrast(110%) brightness(100%)";
          ctx.globalAlpha = 0.5;
          ctx.drawImage(canvas, 0, 0);
          ctx.globalAlpha = 1.0;
        }

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = (e) => {
        if (tempUrl) URL.revokeObjectURL(tempUrl);
        reject(e);
      };
      img.src = src;
    });
  },

  getImageDimensions: async (imageSrc) => {
    let src = imageSrc;
    let tempUrl = null;
    if (imageSrc instanceof File || imageSrc instanceof Blob) {
      tempUrl = URL.createObjectURL(imageSrc);
      src = tempUrl;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (tempUrl) URL.revokeObjectURL(tempUrl);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = (error) => {
        if (tempUrl) URL.revokeObjectURL(tempUrl);
        reject(error);
      };
      img.src = src;
    });
  },

  recognizePopularOriginAccount: async (worker, image) => {
    const { width, height } = await ocrService.getImageDimensions(image);
    const rectangle = {
      left: Math.floor(width * 0.45),
      top: Math.floor(height * 0.32),
      width: Math.floor(width * 0.52),
      height: Math.floor(height * 0.14),
    };

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "0123456789",
    });

    const {
      data: { text },
    } = await worker.recognize(image, { rectangle });

    return text.trim();
  },

  recognizePrimaryAmountRegion: async (worker, image) => {
    const { width, height } = await ocrService.getImageDimensions(image);
    const rectangle = {
      left: Math.floor(width * 0.12),
      top: Math.floor(height * 0.1),
      width: Math.floor(width * 0.76),
      height: Math.floor(height * 0.28),
    };

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "",
    });

    const {
      data: { text },
    } = await worker.recognize(image, { rectangle });

    return text.trim();
  },

  recognizeMiddleAmountRegion: async (worker, image) => {
    const { width, height } = await ocrService.getImageDimensions(image);
    const rectangle = {
      left: Math.floor(width * 0.12),
      top: Math.floor(height * 0.4),
      width: Math.floor(width * 0.76),
      height: Math.floor(height * 0.32),
    };

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "",
    });

    const {
      data: { text },
    } = await worker.recognize(image, { rectangle });

    return text.trim();
  },

  /**
   * Parses raw OCR text into a structured JSON
   */
  parseReceiptText: (
    text,
    bankList = [],
    currencyList = [],
    accountList = [],
    accountHintText = "",
    ocrContext = {},
  ) => {
    const result = {
      bank: null,
      amount: null,
      description: null,
      currency: null,
      targetAccount: null,
      accountError: null,
      isValid: false,
      confidence: 0,
      requiresManualReview: false,
    };

    // --- PHASE 1: NORMALIZATION ---
    const normalizedText = normalizeOcrText(text);

    // --- PHASE 2: BANK DETECTION ---
    {
      const bankKeywordsMap = {
        popular: [
          "popular",
          "bpd",
          "banco popular dominicano",
          "app popular",
          "transferir expresos",
          "tu transferencia ha sido realizada",
          "pago realizado",
          "transferencia exitosa",
          "comprobante de pago",
        ],
        banfondesa: ["banfondesa"],
        reservas: [
          "reservas",
          "banreservas",
          "netdirecto",
          "banco de reservas",
          "tubanco",
          "transacción procesada",
          "transacción fue realizada",
          "el banco de los dominicanos",
        ],
        bhd: [
          "bhd",
          "leon",
          "bhdleon",
          "bhi",
          "bmd",
          "8hd",
          "1-01-13679-2",
          "monto total de la transacción",
          "código qr para confirmar",
          "deposito a cuenta",
          "depósito a cuenta",
          "referencia :",
        ],
        "santa cruz": [
          "santa cruz",
          "banco santa cruz",
          "santacruz",
          "bsc",
          "1-02-01292-1",
          "detalle de la transacción",
          "deposito a cuenta",
          "depósito a cuenta",
          "volante de depósito",
          "caja sucursal",
          "firma depositante",
        ],
        scotiabank: ["scotiabank", "scotia"],
        promerica: ["promerica", "confirmación de transferencia"],
        "asociacion popular": [
          "apap",
          "asociacion popular",
          "asociación popular",
        ],
        "asociacion cibao": ["acap", "asociacion cibao", "cibao ap"],
        "asociacion la nacional": [
          "la nacional",
          "alnap",
          "asociacion nacional",
          "asociación la nacional",
        ],
        "asociacion bonao": ["bonao", "abonap"],
        "asociacion duarte": ["duarte", "adap"],
        "asociacion la vega real": ["la vega real", "alaver"],
        "asociacion maguana": ["maguana"],
        "asociacion mocana": ["mocana"],
        "asociacion peravia": ["peravia"],
        "asociacion romana": ["romana"],
        "banco adopem": ["adopem"],
        "banco agricola": ["agricola"],
        "banco atlantico": ["atlantico"],
        "banco atlas": ["atlas"],
        "banco bacc": ["bacc"],
        "banco bancotui": ["bancotui"],
        "banco caribe": ["caribe"],
        "banco central": ["banco central"],
        "banco cofaci": ["cofaci"],
        "banco confisa": ["confisa"],
        "banco de ahorro y credito fondesa": ["fondesa"],
        "banco fihogar": ["fihogar"],
        "banco gruficorp": ["gruficorp"],
        "banco lopez de haro": ["lopez de haro"],
        "banco multiple jmmb": ["jmmb"],
        "banco multiple lafise": ["lafise"],
        "banco multiple ademi": ["ademi"],
        "banco optima": ["optima"],
        "banco union": ["banco union"],
        "banco vimenca": ["vimenca"],
        banesco: [
          "banesco",
          "transferencia enviada",
          "referencia de la operación",
        ],
        "bonanza banco": ["bonanza"],
        citibank: ["citibank", "citi"],
        "corporacion de credito nordestana": ["nordestana"],
        "leasing confisa": ["leasing confisa"],
        "motor credito": ["motor credito"],
        qik: ["qik", "qik banco", "¡listo!", "monto enviado"],
      };

      let matches = [];
      for (const [key, keywords] of Object.entries(bankKeywordsMap)) {
        for (const kw of keywords) {
          const regex = new RegExp(`${kw}`, "i");
          const match = normalizedText.match(regex);
          if (match) {
            const lineIndex = normalizedText
              .slice(0, match.index)
              .split("\n").length;
            const weight = lineIndex < 5 ? 15 : 5;
            matches.push({ key, id: key, index: match.index, weight });
          }
        }
      }

      if (matches.length > 0) {
        matches.sort((a, b) => b.weight - a.weight || a.index - b.index);
        const bestMatchCategory = matches[0].key;

        // Always report the detected bank regardless of the bankList
        result.detectedBankCategory = bestMatchCategory;
        result.detectedBankLabel =
          BANK_DISPLAY_NAMES[bestMatchCategory] ?? bestMatchCategory;
        result.confidence += 30;

        // If a bankList was provided, try to find the exact match for the `bank` id field
        if (bankList.length > 0) {
          const matchingBank = bankList.find((b) => {
            const bName = b.name.toLowerCase();
            return (
              bName.includes(bestMatchCategory) ||
              bankKeywordsMap[bestMatchCategory]?.some((k) => bName.includes(k))
            );
          });
          if (matchingBank) {
            result.bank = matchingBank.id;
            result.bankName = matchingBank.name;
            result.confidence += 15;
          } else {
            result.bankName = result.detectedBankLabel;
          }
        } else {
          result.bankName = result.detectedBankLabel;
        }
      }
    }

    // --- PHASE 3: AMOUNT DETECTION ---
    const amountDetection = detectAmountCandidate(normalizedText, ocrContext);
    if (amountDetection.candidate) {
      const selectedAmount = amountDetection.candidate;
      result.amount = selectedAmount.value;
      result.amountMatchType = selectedAmount.positiveContext
        ? "labeled"
        : selectedAmount.hasCurrency
          ? "currency"
          : "unlabeled";
      result.amountSelectionReason = selectedAmount.contextType
        ? selectedAmount.contextType
        : selectedAmount.isUpperCenter || selectedAmount.isFocusedPrimaryRegion
          ? "upperCenter"
          : "singleMonetaryValue";
      result.amountConfidence = Math.min(
        100,
        Math.max(60, Math.round(selectedAmount.score * 0.8)),
      );
      result.confidence += selectedAmount.positiveContext
        ? 55
        : selectedAmount.hasCurrency
          ? 40
          : 20;
    } else {
      result.amountError = amountDetection.error;
      result.requiresManualReview = true;
    }

    // --- PHASE 4: DESCRIPTION DETECTION ---
    const descPatterns = [
      /(?:comentario|motivo|cliente|nombre|mensaje|detalle|confirmacion|concepto|beneficiario)[\s:]*(.*)/i,
      /(?:agencia|sucursal|referencia)[\s:]*(.*)/i,
    ];
    for (const pattern of descPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1] && match[1].trim().length > 3) {
        const candidate = match[1].trim().split("\n")[0].substring(0, 50);
        if (!/^\d+$/.test(candidate)) {
          result.description = candidate;
          result.confidence += 10;
          break;
        }
      }
    }

    // --- PHASE 5: ACCOUNT DETECTION ---
    const dynamicTargets = accountList
      .map((account) => {
        const accountNumber =
          account?.numeroCuenta ??
          account?.account ??
          account?.value ??
          account?.number;
        const normalizedAccount = String(accountNumber ?? "").trim();
        const digits = normalizedAccount.replace(/\D/g, "");

        if (!normalizedAccount || digits.length < 4) return null;

        return {
          id: String(account?.id ?? normalizedAccount),
          number: digits,
          account: normalizedAccount,
        };
      })
      .filter(Boolean);

    // Backward compatibility for callers that still do not provide the API catalog.
    const coopTargets =
      dynamicTargets.length > 0
        ? dynamicTargets
        : [
            {
              id: "11135",
              number: "9607299752",
              account: "BRD-9607299752",
            },
            {
              id: "11136",
              number: "9607299819",
              account: "BRD-9607299819",
            },
          ];

    // Prefer the account shown in the source-account block. Popular receipts
    // also contain a beneficiary account, so searching the whole document first
    // can select the wrong number when only a short suffix is visible.
    const originLabelPattern =
      /(?:desde\s+(?:la\s+)?cuenta|cuenta\s+(?:de\s+)?origen|\borigen\s*:)/i;
    const originStopPattern =
      /(?:beneficiario|destinatario|cuenta\s+(?:de\s+)?destino|fecha|impuesto|entidad)/i;
    const normalizedLines = normalizedText.split(/\r?\n/);
    const originLineIndex = normalizedLines.findIndex((line) =>
      originLabelPattern.test(line),
    );
    let originAccountDigits = "";

    const extractAccountDigitGroups = (value) =>
      String(value)
        .split(/\r?\n/)
        .flatMap(
          (line) => line.match(/(?:\d[ \t*#xX•·-]*){3,}/g) ?? [],
        )
        .map((group) => group.replace(/\D/g, ""))
        .filter((digits) => digits.length >= 3);

    const accountHintGroups = extractAccountDigitGroups(accountHintText);
    const accountHintDigits =
      accountHintGroups.find((digits) => digits.length >= 3) ?? "";

    if (originLineIndex >= 0) {
      const originSectionLines = [];
      const originLabelMatch = normalizedLines[originLineIndex].match(
        originLabelPattern,
      );

      for (
        let index = originLineIndex;
        index < Math.min(normalizedLines.length, originLineIndex + 4);
        index += 1
      ) {
        let line = normalizedLines[index];
        if (index === originLineIndex && originLabelMatch) {
          line = line.slice(originLabelMatch.index + originLabelMatch[0].length);
        }

        const stopMatch = line.match(originStopPattern);
        if (stopMatch) {
          originSectionLines.push(line.slice(0, stopMatch.index));
          break;
        }

        originSectionLines.push(line);
      }

      const digitGroups = extractAccountDigitGroups(
        originSectionLines.join("\n"),
      );
      originAccountDigits =
        digitGroups.find((digits) => digits.length >= 3) ?? "";
    }

    if (accountHintDigits) {
      originAccountDigits = accountHintDigits;
    }

    const matchesAccountDigits = (number, suffixLength = null) => {
      const expected = suffixLength ? number.slice(-suffixLength) : number;

      if (originAccountDigits) {
        return suffixLength
          ? originAccountDigits.endsWith(expected)
          : originAccountDigits === expected;
      }

      if (!suffixLength) return normalizedText.includes(expected);
      return new RegExp(`${expected}(?!\\d)`).test(normalizedText);
    };

    const accountMatchTiers = [
      {
        type: "full",
        confidence: () => 30,
        matches: (number) => matchesAccountDigits(number),
      },
      {
        type: "partial",
        confidence: (hasOriginContext) => (hasOriginContext ? 20 : 15),
        matches: (number) => matchesAccountDigits(number, 6),
      },
      {
        type: "lastFour",
        confidence: (hasOriginContext) => (hasOriginContext ? 20 : 5),
        matches: (number) => matchesAccountDigits(number, 4),
      },
      {
        type: "lastThree",
        confidence: (hasOriginContext) => (hasOriginContext ? 10 : 5),
        matches: (number) => matchesAccountDigits(number, 3),
      },
    ];

    let detectedTarget = null;
    for (const tier of accountMatchTiers) {
      const matches = coopTargets.filter((target) =>
        tier.matches(target.number.replace(/\D/g, "")),
      );

      if (matches.length === 1) {
        [detectedTarget] = matches;
        result.accountMatchType = tier.type;
        result.accountMatchContext = accountHintDigits
          ? "focusedPopularOrigin"
          : originAccountDigits
            ? "origin"
            : "global";
        result.confidence += tier.confidence(Boolean(originAccountDigits));
        break;
      }

      if (matches.length > 1) {
        result.accountError = "AMBIGUOUS_TARGET";
        result.accountMatchType = `ambiguous:${tier.type}`;
        break;
      }
    }

    if (detectedTarget) {
      result.targetAccount = detectedTarget.id;
      result.targetAccountSend = detectedTarget.account;
    } else {
      const allLongNumbers = normalizedText.match(/\b\d{9,11}\b/g) || [];
      const hasOtherAccount = allLongNumbers.some((num) => {
        const isOurs = coopTargets.some(
          (t) => t.number.includes(num) || num.includes(t.number.slice(-6)),
        );
        const isAmount =
          result.amount && num.includes(result.amount.replace(".", ""));
        return !isOurs && !isAmount;
      });

      if (
        !result.accountError &&
        hasOtherAccount &&
        normalizedText.toLowerCase().includes("cuenta")
      ) {
        result.accountError = "WRONG_TARGET";
      }
    }

    // --- PHASE 6: CURRENCY DETECTION ---
    if (currencyList.length > 0) {
      const currencyPatternsMap = {
        DOP: [
          "rd\\$",
          "\\bdop\\b",
          "\\brd\\b",
          "pesos dominicanos",
          "rd5",
          "rd s",
        ],
        USD: ["us\\$", "usd", "u.s. dollars", "dólares estadounidenses"],
      };

      const currencyMatches = [];
      for (const [code, patterns] of Object.entries(currencyPatternsMap)) {
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, "i");
          if (regex.test(normalizedText)) {
            currencyMatches.push(code);
            break;
          }
        }
      }

      if (currencyMatches.length > 0) {
        const detectedCode = currencyMatches[0];
        const matchingCurrency = currencyList.find(
          (c) => c.code.toUpperCase() === detectedCode,
        );
        if (matchingCurrency) {
          result.currency = matchingCurrency.id;
          result.confidence += 15;
        }
      } else {
        if (normalizedText.includes("$") || normalizedText.includes("RD")) {
          const dop = currencyList.find((c) => c.code.toUpperCase() === "DOP");
          if (dop) result.currency = dop.id;
        }
      }
    }

    result.confidence = Math.min(result.confidence, 100);
    result.isValid =
      result.amount !== null &&
      !result.requiresManualReview &&
      result.confidence >= 25;
    return result;
  },
};

export default ocrService;
