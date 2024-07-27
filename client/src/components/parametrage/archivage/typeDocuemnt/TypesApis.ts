import { SECore } from "../../../../apis/SECore";






export const addTypeRefDoc  = async (data:any) => {
    
  try {

    const response:any = await SECore.post("/typesDoc",data)
    return response;
  } catch (error) {
    console.error("Error adding type:", error);
    return [];
  }
};


