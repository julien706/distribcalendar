import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to new auth page
    navigate("/auth");
  }, [navigate]);

  return null;
}
