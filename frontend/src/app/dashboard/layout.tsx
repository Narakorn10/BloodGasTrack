"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) {
      setUser({ username: "admin", fullName: "ผู้ดูแลระบบ (Mock)", role: "admin" });
    } else {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("user");
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
