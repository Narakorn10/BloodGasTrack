"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

interface User {
  username: string;
  fullName: string;
  role: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initialize = async () => {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) {
        setUser({ username: "admin", fullName: "ผู้ดูแลระบบ (Mock)", role: "admin" });
      } else {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    };
    initialize();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("cred");
    router.push("/login");
  };

  if (loading) return null;

  return (
    <div id="mainApp" style={{ display: 'block' }}>
      <Header user={user} onLogout={handleLogout} />
      <div className="wrap">
        {children}
      </div>
    </div>
  );
}
