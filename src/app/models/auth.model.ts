// What the backend returns after login/register
// Like a LoginResponseDto in Java
export interface AuthResponse {
  token: string;
  user: { id: number; email: string; lang: string };
}
