
export interface IDependentResourcesProps {
    ResourceType: string;
    Resources: {
      [k: string]: string;
    }[];
  }

export type DependenciesType = { dependencies: Array<IDependentResourcesProps> }

export interface MappingReturnType {
    [k: string]: {
      serviceName: string,
      id: string,
      name: string,
      path: string,
      postFixPath?: string
    }
  }