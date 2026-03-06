// What the backend returns after login/register
// Like a LoginResponseDto in Java
export interface AuthResponse {
  token: string;
  user: { id: number; email: string; lang: string; trekTipCount: number; username: string | null; points: number; quizUnlocked: boolean; photoUrl: string | null; bio: string | null };
}
