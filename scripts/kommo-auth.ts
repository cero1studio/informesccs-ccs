import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function authorizeKommo() {
  const code = process.env.KOMMO_AUTHORIZATION_CODE;
  const clientId = process.env.KOMMO_CLIENT_ID;
  const clientSecret = process.env.KOMMO_CLIENT_SECRET;
  const redirectUri = process.env.KOMMO_REDIRECT_URI;
  const domain = process.env.KOMMO_DOMAIN;

  if (!code || !clientId || !clientSecret || !domain) {
    console.error("Faltan variables de entorno en el archivo .env");
    process.exit(1);
  }

  const tokenUrl = `https://${domain}/oauth2/access_token`;

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  };

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error obteniendo el token:", data);
      process.exit(1);
    }

    // Calcular fecha de expiración (expires_in está en segundos)
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Guardar o actualizar en la base de datos
    await prisma.kommoAuth.upsert({
      where: { id: 1 },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: expiresAt,
      },
      create: {
        id: 1,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: expiresAt,
      }
    });

    console.log("¡Autenticación con Kommo exitosa y tokens guardados en la base de datos!");
    
  } catch (error) {
    console.error("Error de red o de base de datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

authorizeKommo();
