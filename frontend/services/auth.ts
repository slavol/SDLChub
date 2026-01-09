import api from "@/lib/axios";

export const registerUser = async (data: { email: string; password: string; full_name: string }) => {
  const response = await api.post("/auth/register", data);
  return response.data; // Returnează { access_token, token_type }
};

export const loginUser = async (data: { email: string; password: string }) => {
  const response = await api.post("/auth/login", data);
  return response.data; // Returnează { access_token, token_type }
};

export const getMyWorkspaces = async () => {
    const response = await api.get("/workspaces/");
    return response.data;
}