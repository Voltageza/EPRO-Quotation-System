import SolarPanelArrayNode from './SolarPanelArrayNode';
import InverterNode from './InverterNode';
import MpptNode from './MpptNode';
import BatteryNode from './BatteryNode';
import DistributionBoardNode from './DistributionBoardNode';
import GridConnectionNode from './GridConnectionNode';

export const nodeTypes = {
  solarPanelArray: SolarPanelArrayNode,
  inverter: InverterNode,
  mppt: MpptNode,
  battery: BatteryNode,
  distributionBoard: DistributionBoardNode,
  gridConnection: GridConnectionNode,
};

export type DesignerNodeType = keyof typeof nodeTypes;

// Default data for each node type when dragged from palette
export const defaultNodeData: Record<DesignerNodeType, Record<string, any>> = {
  solarPanelArray: {
    label: 'Solar Array',
    panelId: null,
    panelName: '',
    panelPowerW: 0,
    quantity: 12,
  },
  inverter: {
    label: 'Inverter',
    brand: '',
    inverterId: null,
    inverterName: '',
    systemClass: '',
    ratedVa: 0,
    hasMppt: false,
    hasBatteryPort: true,
    maxPvInputW: null,
  },
  mppt: {
    label: 'MPPT Controller',
    mpptId: null,
    mpptName: '',
    modelCode: '',
    quantity: 1,
    maxPvPowerW: null,
  },
  battery: {
    label: 'Battery',
    batteryId: null,
    batteryName: '',
    capacityKwh: 0,
    voltage: 0,
    quantity: 1,
  },
  distributionBoard: {
    label: 'Distribution Board',
  },
  gridConnection: {
    label: 'Grid Connection',
  },
};
