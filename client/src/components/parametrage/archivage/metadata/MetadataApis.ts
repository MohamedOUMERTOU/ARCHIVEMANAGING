import { SECore } from "../../../../apis/SECore";






export const addMetadata = async (data:any) => {
    
  try {
   
    const response:any = await SECore.post("/metadata",data)
    
  
    
    return response;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};


export const getMetadata = async () => {
  try {
    const response:any = await SECore.get("/metadata");
    
    
    return response;
  } catch (error) {
    console.error("Error fetching actions:", error);
    return [];
  }
};