import { SECore } from "./SECore";

export const fetchExampleData = async (url: any) => {
  return await SECore.get(url)
    .then((res) => {
      console.table(res);
    })
    .catch((err) => {
      console.log("Error:" + err);
    });
};
