import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RegisterPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || params.get("inviteToken");
    if (token) {
      setLocation(`/activate?token=${encodeURIComponent(token)}`);
    } else {
      setLocation("/activate");
    }
  }, [setLocation]);

  return null;
}
