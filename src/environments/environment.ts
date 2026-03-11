// Development environment (like application-dev.properties in Spring)
// Used when running locally with `ng serve`
export const environment = {
  production: false,
  apiUrl: '/api',  // Proxied to localhost:3000 by proxy.conf.json
  clerkPublishableKey: 'pk_test_a2Vlbi1mb3hob3VuZC0yMC5jbGVyay5hY2NvdW50cy5kZXYk',
};
