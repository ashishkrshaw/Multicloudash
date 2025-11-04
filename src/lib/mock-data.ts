// Mock data generators for when credentials are not available

export const generateMockAwsCost = () => {
  const currentMonth = new Date();
  const previousMonth = new Date(currentMonth);
  previousMonth.setMonth(previousMonth.getMonth() - 1);

  const dailyCosts = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      start: date.toISOString().split('T')[0],
      amount: Math.random() * 50 + 100, // $100-$150 per day
    };
  });

  return {
    total: { amount: dailyCosts.reduce((sum, day) => sum + day.amount, 0), currency: 'USD' },
    timeSeries: dailyCosts,
    topServices: [
      { service: 'Amazon EC2', amount: 1200 },
      { service: 'Amazon S3', amount: 450 },
      { service: 'Amazon RDS', amount: 380 },
      { service: 'AWS Lambda', amount: 120 },
      { service: 'Amazon CloudFront', amount: 95 },
    ],
    isMock: true,
  };
};

export const generateMockAwsInstances = () => {
  return [
    {
      id: 'i-mock001',
      name: 'web-server-1',
      type: 't3.medium',
      state: 'running' as const,
      region: 'us-east-1',
      launchTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'i-mock002',
      name: 'api-server-1',
      type: 't3.large',
      state: 'running' as const,
      region: 'us-east-1',
      launchTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'i-mock003',
      name: 'database-server',
      type: 't3.xlarge',
      state: 'running' as const,
      region: 'us-west-2',
      launchTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'i-mock004',
      name: 'staging-server',
      type: 't3.small',
      state: 'stopped' as const,
      region: 'us-east-1',
      launchTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

export const generateMockAwsBuckets = () => {
  return [
    { name: 'my-app-assets', creationDate: '2024-01-15', region: 'us-east-1' },
    { name: 'backup-data-prod', creationDate: '2024-02-20', region: 'us-west-2' },
    { name: 'logs-archive', creationDate: '2024-03-10', region: 'us-east-1' },
  ];
};

export const generateMockAzureOverview = () => {
  return {
    cost: [
      {
        label: 'Current Month',
        total: { amount: 2850, currency: 'USD' },
        byService: [
          { service: 'Virtual Machines', amount: 1200 },
          { service: 'Storage Accounts', amount: 650 },
          { service: 'Azure SQL Database', amount: 520 },
          { service: 'App Service', amount: 280 },
          { service: 'Azure Monitor', amount: 200 },
        ],
        daily: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.random() * 30 + 70,
        })),
      },
      {
        label: 'Previous Month',
        total: { amount: 2650, currency: 'USD' },
        byService: [],
        daily: [],
      },
    ],
    compute: {
      vms: [
        { name: 'web-vm-1', status: 'Running', size: 'Standard_D2s_v3', location: 'eastus' },
        { name: 'api-vm-1', status: 'Running', size: 'Standard_D4s_v3', location: 'eastus' },
        { name: 'test-vm', status: 'Deallocated', size: 'Standard_B2s', location: 'westus' },
      ],
      totals: { total: 3, running: 2, stopped: 0, deallocated: 1 },
    },
    storage: {
      accounts: [
        { name: 'mystorageacct001', location: 'eastus', type: 'StorageV2' },
        { name: 'backupstorage', location: 'westus', type: 'BlobStorage' },
      ],
    },
    errors: [],
    isMock: true,
  };
};

export const generateMockGcpOverview = () => {
  return {
    projectId: 'my-mock-project',
    cost: {
      total: 1850,
      currency: 'USD',
      changePercentage: 0.05,
      byService: [
        { service: 'Compute Engine', amount: 850 },
        { service: 'Cloud Storage', amount: 420 },
        { service: 'Cloud SQL', amount: 320 },
        { service: 'Cloud Functions', amount: 160 },
        { service: 'Cloud CDN', amount: 100 },
      ],
      daily: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.random() * 20 + 50,
      })),
      isMock: true,
    },
    compute: {
      instances: [
        { name: 'instance-1', status: 'RUNNING', machineType: 'n1-standard-2', zone: 'us-central1-a' },
        { name: 'instance-2', status: 'RUNNING', machineType: 'n1-standard-4', zone: 'us-central1-b' },
        { name: 'instance-3', status: 'TERMINATED', machineType: 'n1-standard-1', zone: 'us-west1-a' },
      ],
      totals: { total: 3, running: 2, stopped: 0, terminated: 1 },
    },
    storage: {
      buckets: [
        { name: 'my-app-bucket', location: 'US', storageClass: 'STANDARD' },
        { name: 'backup-bucket', location: 'US-WEST1', storageClass: 'NEARLINE' },
      ],
      totals: { bucketCount: 2, storageGb: 450 },
    },
    sql: {
      instances: [
        { name: 'prod-db', status: 'RUNNABLE', tier: 'db-n1-standard-2', region: 'us-central1' },
      ],
      totals: { total: 1, running: 1 },
    },
    alerts: [],
    errors: [],
    isMock: true,
  };
};
