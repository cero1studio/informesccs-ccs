import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getValidToken(): Promise<string> {
  const auth = await prisma.kommoAuth.findUnique({ where: { id: 1 } });
  
  if (!auth) {
    throw new Error("No hay credenciales de Kommo en la base de datos.");
  }

  // Si el token expira en menos de 5 minutos, lo renovamos
  if (auth.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log("Renovando token de Kommo...");
    const domain = process.env.KOMMO_DOMAIN;
    const url = `https://${domain}/oauth2/access_token`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.KOMMO_CLIENT_ID,
        client_secret: process.env.KOMMO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        redirect_uri: process.env.KOMMO_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al renovar el token: ${await response.text()}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await prisma.kommoAuth.update({
      where: { id: 1 },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
      }
    });

    return data.access_token;
  }

  return auth.accessToken;
}

export async function fetchKommoAPI(endpoint: string, method: string = 'GET', body?: any) {
  const token = await getValidToken();
  const domain = process.env.KOMMO_DOMAIN;
  const url = `https://${domain}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 204) return null; // No content
    throw new Error(`Error en API de Kommo (${response.status}): ${await response.text()}`);
  }

  return response.json();
}
