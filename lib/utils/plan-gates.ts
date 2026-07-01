export const PLAN_FEATURES = {
  standard: {
    maxWorkers: 2,
    excelImport: false,
    barcodeScan: false,
    surpriseCount: false,
    dualAlarm: false,
    photoCount: false,
    liveMonitor: false,
    snapshotReports: false,
    whatsappNightly: false,
    whatsappWeekly: false,
    cnicPhoto: false,
    customerAutoReminders: false,
    bestSellerReport: false,
    pdfExport: false,
    stockCatalogue: false,
    tradeIn: false,
    whatsappSaleAlert: true,
    priceFloor: true,
    cashDeclaration: true,
    udhaarLedger: true,
    accessoriesTracking: true,
    checklistReminder: true,
  },
  pro: {
    maxWorkers: 5,
    excelImport: true,
    barcodeScan: true,
    surpriseCount: true,
    dualAlarm: false,
    photoCount: false,
    liveMonitor: false,
    snapshotReports: true,
    whatsappNightly: true,
    whatsappWeekly: false,
    cnicPhoto: true,
    customerAutoReminders: false,
    bestSellerReport: true,
    pdfExport: false,
    stockCatalogue: false,
    tradeIn: false,
    whatsappSaleAlert: true,
    priceFloor: true,
    cashDeclaration: true,
    udhaarLedger: true,
    accessoriesTracking: true,
    checklistReminder: true,
  },
  boss: {
    maxWorkers: Infinity,
    excelImport: true,
    barcodeScan: true,
    surpriseCount: true,
    dualAlarm: true,
    photoCount: true,
    liveMonitor: true,
    snapshotReports: true,
    whatsappNightly: true,
    whatsappWeekly: true,
    cnicPhoto: true,
    customerAutoReminders: true,
    bestSellerReport: true,
    pdfExport: true,
    stockCatalogue: true,
    tradeIn: true,
    whatsappSaleAlert: true,
    priceFloor: true,
    cashDeclaration: true,
    udhaarLedger: true,
    accessoriesTracking: true,
    checklistReminder: true,
  },
} as const

export type PlanType = keyof typeof PLAN_FEATURES
export type PlanFeature = keyof typeof PLAN_FEATURES.boss

export function canUse(plan: string, feature: Exclude<PlanFeature, 'maxWorkers'>): boolean {
  const val = PLAN_FEATURES[plan as PlanType]?.[feature]
  return typeof val === 'boolean' ? val : false
}

export function getMaxWorkers(plan: string): number {
  return PLAN_FEATURES[plan as PlanType]?.maxWorkers ?? 2
}

export function getPlanFeatures(plan: string) {
  return PLAN_FEATURES[plan as PlanType] ?? PLAN_FEATURES.standard
}
