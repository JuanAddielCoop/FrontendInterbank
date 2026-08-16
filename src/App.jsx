import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import InterbankDashboard from "./pages/InterbankDashboard";
import RegisterUser from "./pages/RegisterUser";
import Login from "./pages/Login";
import BankInboundPage from "./pages/BankInboundPage";
import AccountBookPage from "./pages/AccountBookPage";
import CompensationPage from "./pages/CompensationPage";
import BankExpensesPage from "./pages/BankExpensesPage";
import { useAuth } from "./context/AuthContext";
import { useNotifications } from "./context/NotificationContext";
import NotificationsPanel from "./components/common/NotificationsPanel";
import InactivityModal from "./components/common/InactivityModal";
import useInactivityTimer from "./hooks/useInactivityTimer";

const TAB_CONFIG = [
  {
    id: "interbank",
    label: "Transferencias interbancarias",
    description: "Aprueba, cancela y monitorea los envios del dia a dia.",
    allowedRoles: ["admin", "superadmin", "desarrollador"],
    component: InterbankDashboard,
  },
  {
    id: "bank-inbound",
    label: "Depósitos Interbancarios",
    description:
      "Confirma y gestiona depósitos recibidos desde bancos externos.",
    allowedRoles: ["admin", "superadmin", "desarrollador"],
    component: BankInboundPage,
  },
  {
    id: "register-user",
    label: "Usuarios",
    description: "Registra nuevos usuarios y asigna roles.",
    allowedRoles: ["superadmin", "desarrollador"],
    component: RegisterUser,
  },
  {
    id: "account-book",
    label: "Libro de Cuentas",
    description: "Capital actual, entradas y salidas diarias.",
    allowedRoles: ["admin", "superadmin", "desarrollador"],
    component: AccountBookPage,
  },
  {
    id: "bank-expenses",
    label: "Gastos bancarios",
    description: "Registra cargos y conserva sus notas de auditoría.",
    allowedRoles: ["admin", "superadmin", "desarrollador"],
    component: BankExpensesPage,
  },
  {
    id: "compensation",
    label: "Compensacion",
    description: "Resultados diarios de la compensacion bancaria.",
    allowedRoles: ["admin", "superadmin", "desarrollador"],
    component: CompensationPage,
  },
];

const normalizeRole = (role) =>
  typeof role === "string" ? role.toLowerCase() : "";

const App = () => {
  const { isAuthenticated, roles, user, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    removeNotification,
  } = useNotifications();
  const [activeTab, setActiveTab] = useState("");
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [showInactivityModal, setShowInactivityModal] = useState(false);

  const normalizedRoles = useMemo(
    () => roles.map((role) => normalizeRole(role)).filter(Boolean),
    [roles],
  );

  const accessibleTabs = useMemo(
    () =>
      TAB_CONFIG.filter((tab) =>
        tab.allowedRoles.some((role) => normalizedRoles.includes(role)),
      ),
    [normalizedRoles],
  );

  // Sistema de inactividad - solo cuando el usuario está autenticado
  const { resetTimer } = useInactivityTimer(
    isAuthenticated ? null : null, // 10 segundos o desactivado
    () => {
      if (isAuthenticated) {
        setShowInactivityModal(true);
      }
    },
  );

  useEffect(() => {
    if (!accessibleTabs.length) {
      setActiveTab("");
      return;
    }
    const hasActive = accessibleTabs.some((tab) => tab.id === activeTab);
    if (!hasActive) {
      setActiveTab(accessibleTabs[0].id);
    }
  }, [accessibleTabs, activeTab]);

  const handleLogout = () => {
    setActiveTab("");
    setNotificationsOpen(false);
    setShowInactivityModal(false);
    logout();
  };

  const handleKeepActive = () => {
    setShowInactivityModal(false);
    resetTimer();
  };

  const handleNotificationToggle = () => setNotificationsOpen((prev) => !prev);

  const handleNotificationSelect = (notification) => {
    markAsRead(notification.id);
    setNotificationsOpen(false);
    if (notification.meta?.transferId) {
      setActiveTab("interbank");
    }
  };

  if (!isAuthenticated) {
    return <Login />;
  }

  const currentTab = accessibleTabs.find((tab) => tab.id === activeTab);
  const ActiveView = currentTab?.component ?? null;

  return (
    <div className="min-h-screen bg-dark-bg pb-10 pt-6">
      <main className="mx-auto max-w-6xl px-4">
        <header className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-green">
                Interbank Admin
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Panel operativo
              </h1>
              <p className="text-sm text-gray-400">
                Breve y al grano: priorizamos las transferencias interbancarias
                y validamos que los fondos entren a la cuenta administradora.
              </p>
            </div>
            <div className="relative flex items-center gap-3 rounded-2xl border border-dark-border bg-[#0d121c] px-4 py-3 text-left">
              <div>
                <p className="text-sm font-semibold text-white">
                  {user?.firstName || user?.userName || "Usuario"}
                </p>
                <p className="text-xs text-gray-500">
                  {roles.join(", ") || "Sin rol"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNotificationToggle}
                className="relative rounded-2xl border border-dark-border p-2 text-gray-300 transition hover:border-primary-green/60 hover:text-white"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-primary-green px-1 text-[11px] font-semibold text-black">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <NotificationsPanel
                notifications={notifications}
                isOpen={isNotificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onMarkAllRead={markAllAsRead}
                onSelectNotification={handleNotificationSelect}
                onRemoveNotification={removeNotification}
              />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl border border-dark-border px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
          {accessibleTabs.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {accessibleTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`flex-1 rounded-2xl border px-4 py-3 text-left transition sm:flex-none sm:px-6 ${
                      isActive
                        ? "border-primary-green bg-primary-green/10 text-white"
                        : "border-dark-border bg-[#0d121c] text-gray-400 hover:border-primary-green/60"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <p className="text-sm font-semibold">{tab.label}</p>
                    <p className="text-xs text-gray-500">{tab.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dark-border bg-[#0d121c] px-4 py-3 text-sm text-gray-400">
              Tu usuario no tiene vistas asignadas. Solicita acceso a un
              administrador.
            </div>
          )}
        </header>

        {ActiveView ? (
          <ActiveView />
        ) : accessibleTabs.length ? (
          <div className="rounded-3xl border border-dark-border bg-[#0d121c] p-6 text-center text-gray-400">
            Selecciona una vista disponible para comenzar.
          </div>
        ) : (
          <div className="rounded-3xl border border-dark-border bg-[#0d121c] p-6 text-center text-gray-400">
            No tienes permisos activos. Contacta a un SuperAdmin para
            habilitarlos.
          </div>
        )}
      </main>

      {/* Modal de Inactividad */}
      <InactivityModal
        isOpen={showInactivityModal}
        onClose={handleKeepActive}
        onLogout={handleLogout}
      />
    </div>
  );
};

export default App;
