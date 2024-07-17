import { SECore } from "../../../../apis/SECore";

export const getMenus = async () => {
  try {
    const response:any = await SECore.get("/menus");
    return response;
  } catch (error) {
    console.error("Error fetching menus:", error);
    return [];
  }
};
