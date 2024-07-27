import { SECore } from "../../../../apis/SECore";






export const addAction  = async (data:any) => {
    
  try {

    const response:any = await SECore.post("/operations",data)
    
    
    return response;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};


