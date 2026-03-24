import { getIO } from "./socket";

export async function emitPriceUpdate(cropId: number, marketId: number, price: number) {
  const io = getIO();
  io.emit("priceUpdate", { cropId, marketId, price });
}