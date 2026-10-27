import { z } from 'zod';
import {
  defaultDSSState,
  calculateMarketFreightWithRisk,
  dssCommitSchema,
  handleCommitConditions,
  isExportDeficitPOD,
  jwcRiskKeywords,
  isJWCRiskZone,
  evaluateJWCRisk,
  FALLBACK_PORT_MATRIX,
  getFallbackPortAndDistance,
  calculateAutoExportDeficitBallast,
  calculateAllInFreightGross,
  REEFER_BREAKBULK_OPERATIONAL_WARNING,
  DEFAULT_PDA_TEMPLATE,
  calculatePortCosts,
  MATRIZ_ESTACIONAL_GLOBAL,
  evaluateFruitSeasonality
} from './dss-risk-module.mjs';

export {
  defaultDSSState,
  calculateMarketFreightWithRisk,
  dssCommitSchema,
  handleCommitConditions,
  isExportDeficitPOD,
  jwcRiskKeywords,
  isJWCRiskZone,
  evaluateJWCRisk,
  FALLBACK_PORT_MATRIX,
  getFallbackPortAndDistance,
  calculateAutoExportDeficitBallast,
  calculateAllInFreightGross,
  REEFER_BREAKBULK_OPERATIONAL_WARNING,
  DEFAULT_PDA_TEMPLATE,
  calculatePortCosts,
  MATRIZ_ESTACIONAL_GLOBAL,
  evaluateFruitSeasonality
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    defaultDSSState,
    calculateMarketFreightWithRisk,
    dssCommitSchema,
    handleCommitConditions,
    isExportDeficitPOD,
    jwcRiskKeywords,
    isJWCRiskZone,
    evaluateJWCRisk,
    FALLBACK_PORT_MATRIX,
    getFallbackPortAndDistance,
    calculateAutoExportDeficitBallast,
    calculateAllInFreightGross,
    REEFER_BREAKBULK_OPERATIONAL_WARNING,
    DEFAULT_PDA_TEMPLATE,
    calculatePortCosts,
    MATRIZ_ESTACIONAL_GLOBAL,
    evaluateFruitSeasonality
  };
}
