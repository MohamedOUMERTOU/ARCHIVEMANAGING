import { FC, useContext, useEffect, useState } from 'react';
import SEgrid from '../../../../core/SEgrid';
import { SEContext } from '../../../../context/userSEContext';
import { SECore } from '../../../../apis/SECore';

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
    }
  ];

  const handleRowClick = (record: any) => {
    setSelectedItem(record);
  };

  console.log("actions", actions);
  console.log("selectedItem", selectedItem);

  return (
    <>
      <SEgrid
        data={actions}
        columns={columns}
        col={12}
        onRowClick={handleRowClick}
      />
      {selectedItem && (
        <div>
          <h2>Selected Item Details</h2>
          <p>ID: {selectedItem.idOperation}</p>
          <p>Name: {selectedItem.name}</p>
          <p>Description: {selectedItem.description}</p>
        </div>
      )}
    </>
  );
};

export default ListAction;
