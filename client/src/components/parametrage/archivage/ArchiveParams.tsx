import { FC } from 'react';
import { Icons } from '../../../core/SEIcons';
import SETabs from '../../../core/SETabs';
import Index from './actionDocument/Index';
import Types from './typeDocuemnt';
// Adjust the import based on your actual icon library

const ArchiveParams: FC = () => {
  const items = [
    {
      key: "1",
      label: (
        <span>
          <Icons.ClusterOutlined className='orange' style={{ marginRight:'10px' }} />
          Hiérarchie de L'archivage
        </span>
      ),
      children: <div>Your content here 1</div>, // Replace with your actual content
    },
    {
      key: "4",
      label: (
        <span>
          <Icons.FileOutlined className='red' style={{ marginRight:'10px' }} />
          Type de document
        </span>
      ),
      children: <Types />, // Correct usage of TypesDocuments component
    },
    {
        key: "2",
        label: (
          <span>
            <Icons.AppstoreAddOutlined className='green' style={{ marginRight:'10px'}}/>
            Paramètrage des actions
          </span>
        ),
        children: <Index/>, // Replace with your actual content
      },
      {
        key: "3",
        label: (
          <span>
            <Icons.IdcardOutlined className='purple' style={{ marginRight:'10px'}}/>
           Paramètrage de Metadata
          </span>
        ),
        children: <div>Your content here 4</div>, // Replace with your actual content
      },
     
  ];

  return (
    <SETabs items={items} onChange={(key) => console.log('Tab changed:', key)} />
  );
};

export default ArchiveParams;
