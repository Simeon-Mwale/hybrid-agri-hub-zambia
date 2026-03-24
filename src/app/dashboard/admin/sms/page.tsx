// src/app/admin/sms/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSMSPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/sms-queue');
      const data = await res.json();
      setData(data);
    } catch (error) {
      console.error('Failed to fetch SMS queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerAction = async (action: string) => {
    try {
      await fetch('/api/admin/sms-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      // Show success message
      alert(`${action} triggered successfully`);
      fetchData(); // Refresh
    } catch (error) {
      alert(`Failed to trigger ${action}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">SMS & Alerts Management</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{data?.stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Sent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{data?.stats.sent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{data?.stats.failed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Active Alerts</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{data?.stats.activeAlerts}</div></CardContent>
        </Card>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => triggerAction('process-sms')}>Process SMS Queue</Button>
        <Button onClick={() => triggerAction('check-alerts')}>Check Price Alerts</Button>
        <Button onClick={() => triggerAction('generate-predictions')}>Generate Predictions</Button>
      </div>

      {/* Queue Items */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {['pending', 'sent', 'failed', 'all'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader><CardTitle>{tab.toUpperCase()} Messages</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.queue
                    .filter((item: any) => tab === 'all' ? true : item.status === tab.toUpperCase())
                    .map((item: any) => (
                      <div key={item.id} className="border-b pb-4">
                        <p className="font-medium">{item.phone}</p>
                        <p className="text-sm">{item.message}</p>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>Status: {item.status}</span>
                          <span>Attempts: {item.attempts}</span>
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        {item.response && (
                          <p className="text-xs text-gray-400">Response: {item.response}</p>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}