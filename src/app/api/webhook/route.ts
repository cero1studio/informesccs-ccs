import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Kommo envía webhooks como form-data (application/x-www-form-urlencoded)
    const formData = await req.formData();
    
    // Convertir FormData a un objeto plano para facilitar el log y el manejo
    const data: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    console.log("Webhook de Kommo recibido:", data);

    // TODO: Procesar la actualización del lead/etiqueta y guardar en la base de datos local
    
    // Emitir evento por WebSockets para actualizar el Dashboard en tiempo real
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    await fetch(`${socketUrl}/api/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kommo_update',
        data: { message: 'Nuevo evento de Kommo procesado', raw: data }
      })
    }).catch(err => console.error("Error emitiendo al socket:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error procesando Webhook:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
