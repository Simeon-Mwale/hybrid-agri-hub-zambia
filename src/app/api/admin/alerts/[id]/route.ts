import { NextResponse } from "next/server";

// Mock data for demonstration
let alerts = [
  { 
    id: "1", 
    userId: "u1", 
    cropId: "c1", 
    marketId: "m1", 
    targetPrice: 15.00, 
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  { 
    id: "2", 
    userId: "u2", 
    cropId: "c2", 
    marketId: "m2", 
    targetPrice: 20.00, 
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  { 
    id: "3", 
    userId: "u3", 
    cropId: "c1", 
    marketId: "m2", 
    targetPrice: 18.50, 
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
];

const users = [
  { id: "u1", name: "John Farmer", email: "john@example.com", phone: "+260 97 123 4567" },
  { id: "u2", name: "Mary Cooper", email: "mary@example.com", phone: "+260 96 234 5678" },
  { id: "u3", name: "Peter Mwamba", email: "peter@example.com", phone: "+260 95 345 6789" },
];

const crops = [
  { id: "c1", name: "Maize", category: "Grains" },
  { id: "c2", name: "Rice", category: "Grains" },
  { id: "c3", name: "Soybeans", category: "Oilseeds" },
];

const markets = [
  { id: "m1", name: "Lusaka", province: "Lusaka" },
  { id: "m2", name: "Ndola", province: "Copperbelt" },
  { id: "m3", name: "Kitwe", province: "Copperbelt" },
];

// Helper function to enrich alert with related data
function enrichAlert(alert: any) {
  const user = users.find(u => u.id === alert.userId);
  const crop = crops.find(c => c.id === alert.cropId);
  const market = markets.find(m => m.id === alert.marketId);
  
  return {
    ...alert,
    user: user || null,
    crop: crop || null,
    market: market || null,
    cropName: crop?.name || alert.cropId,
    marketName: market?.name || alert.marketId,
    userName: user?.name || 'Unknown User'
  };
}

// GET /api/admin/alerts/[id]
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    const alert = alerts.find(a => a.id === id);
    
    if (!alert) {
      return NextResponse.json(
        { success: false, message: "Alert not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: enrichAlert(alert)
    });
    
  } catch (error) {
    console.error("Error in GET /api/admin/alerts/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/alerts/[id]
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();
    
    const index = alerts.findIndex(a => a.id === id);
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, message: "Alert not found" },
        { status: 404 }
      );
    }
    
    // Update only allowed fields
    const updatedAlert = {
      ...alerts[index],
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.targetPrice !== undefined && { 
        targetPrice: typeof body.targetPrice === 'number' && body.targetPrice > 0 
          ? body.targetPrice 
          : alerts[index].targetPrice 
      }),
      updatedAt: new Date().toISOString()
    };
    
    alerts[index] = updatedAlert;
    
    return NextResponse.json({ 
      success: true, 
      data: enrichAlert(updatedAlert),
      message: "Alert updated successfully"
    });
    
  } catch (error) {
    console.error("Error in PATCH /api/admin/alerts/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/alerts/[id]
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();
    const index = alerts.findIndex(a => a.id === id);
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, message: "Alert not found" },
        { status: 404 }
      );
    }
    
    // Validate fields if provided
    if (body.targetPrice && (typeof body.targetPrice !== 'number' || body.targetPrice <= 0)) {
      return NextResponse.json(
        { success: false, message: "targetPrice must be a positive number" },
        { status: 400 }
      );
    }
    
    // Check if user, crop, and market exist if being updated
    if (body.userId && !users.find(u => u.id === body.userId)) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }
    
    if (body.cropId && !crops.find(c => c.id === body.cropId)) {
      return NextResponse.json(
        { success: false, message: "Crop not found" },
        { status: 404 }
      );
    }
    
    if (body.marketId && !markets.find(m => m.id === body.marketId)) {
      return NextResponse.json(
        { success: false, message: "Market not found" },
        { status: 404 }
      );
    }
    
    const updatedAlert = {
      ...alerts[index],
      ...body,
      updatedAt: new Date().toISOString()
    };
    
    alerts[index] = updatedAlert;
    
    return NextResponse.json({ 
      success: true, 
      data: enrichAlert(updatedAlert),
      message: "Alert updated successfully"
    });
    
  } catch (error) {
    console.error("Error in PUT /api/admin/alerts/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/alerts/[id]
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    const initialLength = alerts.length;
    alerts = alerts.filter(a => a.id !== id);
    
    if (alerts.length === initialLength) {
      return NextResponse.json(
        { success: false, message: "Alert not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Alert deleted successfully" 
    });
    
  } catch (error) {
    console.error("Error in DELETE /api/admin/alerts/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}