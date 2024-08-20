import { FC, useContext, useEffect, useState } from "react";
import { SECore } from "../../../../apis/SECore";
import { SEContext } from "../../../../context/userSEContext";
import SEgrid from "../../../../core/SEgrid";
import SECol from "../../../../core/SECol";

const ListAction: FC = () => {
  const context = useContext(SEContext);
  if (!context) {
    throw new Error("SEContext must be used within a SEContextProvider");
  }
  const { actions, setActions } = context;
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    const fetchActions = async () => {
      const response: any = await SECore.get("/operations");
      setActions(response);
    };

    fetchActions();
  }, []);


  const columns = [
    {
      title: "ID",
      dataIndex: "idOperation",
      key: "idOperation",
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
  ];
  const metacolumn = [
   
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

  const handleRowClick = (record: any) => {
    setSelectedItem(record);
  };

  return (
    <SECol span={24}offset={2} style={{display:'flex'}}>
    <SEgrid
      data={actions}
      columns={columns}
      col={12}
      onRowClick={handleRowClick}
    />
    {selectedItem && (
       <SEgrid
       data={[selectedItem]}
       columns={metacolumn}
       col={12}
     
     />
    )}
  </SECol>
  );
};

export default ListAction;
