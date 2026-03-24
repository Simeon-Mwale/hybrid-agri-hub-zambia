"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";   // ← add this

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();                   // ← add this

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log("login response", res.status, data);

      if (res.ok) {
        // Support both { role } and { user: { role } } and { data: { role } }
        const role = data.role ?? data.user?.role ?? data.data?.role;

        if (role === "ADMIN") {
          router.push("/dashboard/admin");
        } else if (role === "FARMER") {
          router.push("/dashboard/farmer");
        } else {
          router.push("/dashboard");
        }
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network or server error");
      console.error(err);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded shadow-md w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">
          Login - Hybrid Agri Hub Zambia
        </h2>

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 transition"
        >
          Login
        </button>

        {error && <p className="mt-4 text-red-600 text-center">{error}</p>}

        {/* Register button always visible */}
        <div className="mt-4 text-center">
          <a
            href="/register"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Register Here
          </a>
        </div>
      </form>
    </div>
  );
}