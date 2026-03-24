 "use client";

import { useEffect, useState } from "react";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/admin/users").then(res => res.json()).then(setUsers);
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Manage Users</h1>

      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Full Name</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u:any, idx:number) => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{idx+1}</td>
              <td className="p-2">{u.fullName}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

