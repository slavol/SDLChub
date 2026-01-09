import api from "@/lib/axios";

// Tipuri de date (Exact ce așteaptă Pydantic în backend)
export interface LoginData {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    full_name: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    has_pending_invites: boolean;
}

// Apelurile către API
export const loginUser = async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post("/auth/login", data);
    return response.data;
};

export const registerUser = async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post("/auth/register", data);
    return response.data;
};