import api from "@/lib/axios";

export const joinByCode = async (code: string) => {
    const response = await api.post("/invitations/join", { code });
    return response.data;
};

export const checkPendingInvites = async () => {
    const response = await api.get("/invitations/pending");
    return response.data;
};