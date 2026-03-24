import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload();
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const crop = searchParams.get("crop");
    const market = searchParams.get("market");
    const days = parseInt(searchParams.get("days") || "90");

    if (!crop || !market) {
      return NextResponse.json(
        { success: false, error: "Crop and market are required" },
        { status: 400 }
      );
    }

    // Find crop and market by name (using contains for case-insensitive matching)
    const cropRecord = await prisma.crop.findFirst({
      where: {
        name: {
          equals: crop,
        }
      }
    });
    
    const marketRecord = await prisma.market.findFirst({
      where: {
        name: {
          equals: market,
        }
      }
    });

    if (!cropRecord || !marketRecord) {
      // Try case-insensitive search as fallback
      const cropFallback = await prisma.crop.findFirst({
        where: {
          name: {
            contains: crop,
          }
        }
      });
      
      const marketFallback = await prisma.market.findFirst({
        where: {
          name: {
            contains: market,
          }
        }
      });
      
      if (!cropFallback || !marketFallback) {
        return NextResponse.json(
          { success: false, error: "Crop or market not found" },
          { status: 404 }
        );
      }
      
      // Use fallback records
      const priceHistory = await prisma.dailyPrice.findMany({
        where: {
          cropId: cropFallback.id,
          marketId: marketFallback.id,
        },
        orderBy: {
          priceDate: "asc"
        },
        take: 365
      });

      const predictions = await prisma.prediction.findMany({
        where: {
          cropId: cropFallback.id,
          marketId: marketFallback.id,
        },
        orderBy: {
          predictionDate: "asc"
        }
      });

      const labels = priceHistory.map(p => 
        new Date(p.priceDate).toLocaleDateString()
      );
      
      const prices = priceHistory.map(p => p.price);
      
      const predictionsMap = new Map();
      predictions.forEach(p => {
        const dateKey = new Date(p.predictionDate).toLocaleDateString();
        predictionsMap.set(dateKey, p.predictedPrice);
      });

      const alignedPredictions = labels.map(date => 
        predictionsMap.get(date) || null
      );

      return NextResponse.json({
        success: true,
        data: {
          labels,
          prices,
          predictions: alignedPredictions,
          cropName: crop,
          marketName: market
        }
      });
    }

    // Get ALL price history (no date limit to show all available data)
    const priceHistory = await prisma.dailyPrice.findMany({
      where: {
        cropId: cropRecord.id,
        marketId: marketRecord.id,
      },
      orderBy: {
        priceDate: "asc"
      },
      take: 365 // Show up to 1 year of data
    });

    // Get predictions
    const predictions = await prisma.prediction.findMany({
      where: {
        cropId: cropRecord.id,
        marketId: marketRecord.id,
      },
      orderBy: {
        predictionDate: "asc"
      }
    });

    // Format data for chart
    const labels = priceHistory.map(p => 
      new Date(p.priceDate).toLocaleDateString()
    );
    
    const prices = priceHistory.map(p => p.price);
    
    // Create a map of predictions by date
    const predictionsMap = new Map();
    predictions.forEach(p => {
      const dateKey = new Date(p.predictionDate).toLocaleDateString();
      predictionsMap.set(dateKey, p.predictedPrice);
    });

    // Align predictions with price dates
    const alignedPredictions = labels.map(date => 
      predictionsMap.get(date) || null
    );

    return NextResponse.json({
      success: true,
      data: {
        labels,
        prices,
        predictions: alignedPredictions,
        cropName: crop,
        marketName: market
      }
    });

  } catch (error) {
    console.error("GET /api/farmer/prices/trends error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}