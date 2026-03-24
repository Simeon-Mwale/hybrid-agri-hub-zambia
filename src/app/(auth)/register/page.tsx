"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email,
          phone: phone.trim() || undefined,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // ✅ Cookie is already set by register API — just redirect
      const role = data.role;
      router.push(role === "ADMIN" ? "/dashboard/admin" : "/dashboard/farmer");

    } catch (err) {
      setError("Network or server error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded shadow-md w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">
          Farmer Registration
        </h2>
        <p className="text-sm text-center text-gray-500 mb-6">
          Hybrid Agri Hub Zambia
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mb-4 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />

        <input
          type="tel"
          placeholder="Phone Number e.g. 0971234567 (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-4 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-6 w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 transition disabled:opacity-50 font-medium"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <div className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <a href="/login" className="text-green-600 hover:underline font-medium">
            Login here
          </a>
        </div>
      </form>
    </div>
  );
}