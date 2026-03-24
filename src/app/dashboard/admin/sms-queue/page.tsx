"use client";

import { useEffect, useState } from "react";

export default function SmsQueuePage() {
  const [smsQueue, setSmsQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQueue() {
      try {
        const res = await fetch("/api/admin/sms-queue?limit=50");
        const data = await res.json();
        // Make sure to extract queue and default to empty array
        setSmsQueue(data?.queue ?? []);
      } catch (err) {
        console.error("Failed to load SMS queue:", err);
        setSmsQueue([]);
      } finally {
        setLoading(false);
      }
    }
    fetchQueue();
  }, []);

  if (loading) return <p>Loading SMS queue...</p>;

  if (smsQueue.length === 0) return <p>No SMS in queue.</p>;

  return (
    <div>
      <h1>SMS Queue</h1>
      <ul>
        {smsQueue.map((item) => (
          <li key={item.id}>
            {item.phone}: {item.message} ({item.status})
          </li>
        ))}
      </ul>
    </div>
  );
}