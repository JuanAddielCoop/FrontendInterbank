import api from "../lib/axiosInstance";
import { useState } from "react";

const usePost = (url) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState();
  const [error, setError] = useState();

  const postData = async (body) => {
    setLoading(true)
    try {
      const res = await api.post(url, body);

      if(res.data){
        setData(res.data)
      }

      return res.data
    } catch (err) {
        setError(err.message)
    }finally{
        setLoading(false)
    }
  };
  return {loading, data, error, postData};
};

export default usePost;
