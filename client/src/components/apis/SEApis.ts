// In SEApis.ts or wherever you define your API functions
import { SECore } from "./SECore";

export const getMenus = async () => {
  try {
    const response:any = await SECore.get("/menus");
    return response;
  } catch (error) {
    console.error("Error fetching menus:", error);
    return [];
  }
};
