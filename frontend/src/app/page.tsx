"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe().then((user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!ready) return null;
  return <KanbanBoard onLogout={handleLogout} />;
}
