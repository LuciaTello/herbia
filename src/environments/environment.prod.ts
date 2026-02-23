// Production environment (like application-prod.properties in Spring)
// API_URL will be replaced at build time with the real Render URL
export const environment = {
  production: true,
  apiUrl: 'RENDER_API_URL_PLACEHOLDER',  // We'll replace this after creating the Render service
};
