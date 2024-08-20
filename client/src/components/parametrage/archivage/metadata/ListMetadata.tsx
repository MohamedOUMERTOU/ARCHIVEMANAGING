import { useEffect, useState } from "react";
import SEgrid from "../../../../core/SEgrid";
import { getMetadata } from "./MetadataApis";

const ListMetadata = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const result = await getMetadata();
      setData(result);
    };

    fetchMetadata();
  }, []);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "code",
      dataIndex: "key",
      key: "key",
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
  
  ];
console.log('my metadata',data);

  return <SEgrid data={data} columns={columns} col={24} />;
};

export default ListMetadata;
