import { SECore } from "../../../../apis/SECore";

export const getUtilisateurs = async () => {
  try {
    const response:any = await SECore.get("/users");
    localStorage.setItem('users', JSON.stringify(response));
    
    return response;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};
