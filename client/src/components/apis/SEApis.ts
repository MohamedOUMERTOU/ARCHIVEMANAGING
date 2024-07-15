import { SECore } from "./SECore";
export const getMenus = async () => {
  return await SECore.get("/menus")
    .then((res) => {
      console.log(res);
    })
    .catch((err) => {
      console.log("Error:" + err);
    });
};


