// lib/ussd-session.ts
import { prisma } from './prisma';

export interface USSDSessionData {
  step: string;
  cropId?: string;
  marketId?: string;
  targetPrice?: number;
  data: Record<string, any>;
}

/**
 * Get or create USSD session for a user
 */
export async function getOrCreateSession(
  sessionId: string,
  phoneNumber: string
): Promise<{ session: any; data: USSDSessionData }> {
  let session = await prisma.ussdSession.findUnique({
    where: { sessionId }
  });

  if (!session) {
    session = await prisma.ussdSession.create({
       {
        sessionId,
        phoneNumber,
        step: 'main',
         '{}'
      }
    });
  }

  // Parse session data
  let parsedData: USSDSessionData;
  try {
    parsedData = JSON.parse(session.data);
  } catch {
    parsedData = { step: 'main',  {} };
  }

  return { session,  parsedData };
}

/**
 * Update session step and data
 */
export async function updateSession(
  sessionId: string,
  step: string,
  data: Partial<Record<string, any>> = {}
) {
  const session = await prisma.ussdSession.findUnique({
    where: { sessionId }
  });

  let currentData = {};
  if (session?.data) {
    try {
      currentData = JSON.parse(session.data);
    } catch {}
  }

  await prisma.ussdSession.update({
    where: { sessionId },
     {
      step,
       JSON.stringify({ ...currentData, ...data }),
      updatedAt: new Date()
    }
  });
}

/**
 * End/close USSD session
 */
export async function endSession(sessionId: string) {
  await prisma.ussdSession.delete({
    where: { sessionId }
  }).catch(() => {}); // Ignore if already deleted
}

/**
 * Get user by phone number (for authentication)
 */
export async function getUserByPhone(phoneNumber: string) {
  const { prisma } = await import('./prisma');
  
  // Try to find registered user
  let user = await prisma.user.findUnique({
    where: { phone: phoneNumber }
  });

  // If not found, check farmer registrations
  if (!user) {
    const registration = await prisma.farmerRegistration.findUnique({
      where: { phoneNumber }
    });
    
    if (registration?.userId) {
      user = await prisma.user.findUnique({
        where: { id: registration.userId }
      });
    }
  }

  return user;
}