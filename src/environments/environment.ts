// Development environment (like application-dev.properties in Spring)
// Used when running locally with `ng serve`
export const environment = {
  production: false,
  apiUrl: '/api',  // Proxied to localhost:3000 by proxy.conf.json
};
