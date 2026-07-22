/**
 * Verification Hub - webdocsol
 *
 * Receives contradiction feedback from Verum Omnis Android apps,
 * manages human verification workflow, and sends evolved rules back
 * to improve the forensic engine.
 *
 * This is the collective learning center - aggregates findings from
 * all users and feeds improvements back to every device.
 */

class VerificationHub {
  constructor() {
    this.feedbackQueue = new Map();
    this.verifiedContradictions = new Map();
    this.ruleEvolutionTracker = new Map();
    this.deviceRegistry = new Map();
  }

  /**
   * Receive contradiction feedback packet from Android device.
   * Validates packet and enqueues for human review.
   */
  receiveFeedbackPacket(packet) {
    if (!this.validatePacket(packet)) {
      return {
        status: 'INVALID_PACKET',
        errors: this.getPacketErrors(packet),
        timestamp: new Date().toISOString()
      };
    }

    const packetId = packet.packetId;
    const processedPacket = {
      ...packet,
      receivedAt: new Date().toISOString(),
      status: 'PENDING_REVIEW',
      verificationStatus: null,
      humanReviewer: null,
      reviewComments: ''
    };

    this.feedbackQueue.set(packetId, processedPacket);

    // Register device if new
    if (!this.deviceRegistry.has(packet.deviceHash)) {
      this.deviceRegistry.set(packet.deviceHash, {
        firstSeen: new Date().toISOString(),
        packetsSubmitted: 1,
        jurisdiction: packet.jurisdiction,
        constitutionVersion: packet.constitutionVersion
      });
    } else {
      const entry = this.deviceRegistry.get(packet.deviceHash);
      entry.packetsSubmitted += 1;
    }

    return {
      status: 'PACKET_ACCEPTED',
      packetId: packetId,
      contradictionCount: packet.contradictions.length,
      message: 'Packet queued for human verification',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Submit human verification of a contradiction.
   * Updates verification status and triggers rule evolution if needed.
   */
  submitVerification(packetId, contradictionId, verification) {
    const packet = this.feedbackQueue.get(packetId);
    if (!packet) {
      return { status: 'PACKET_NOT_FOUND' };
    }

    const contradiction = packet.contradictions.find(c => c.contradictionId === contradictionId);
    if (!contradiction) {
      return { status: 'CONTRADICTION_NOT_FOUND' };
    }

    const verificationRecord = {
      contradictionId: contradictionId,
      verified: verification.approved,
      confidence: verification.confidence,
      reviewer: verification.reviewer,
      comments: verification.comments,
      corrections: verification.corrections || [],
      verifiedAt: new Date().toISOString(),
      sourcePacket: packetId
    };

    this.verifiedContradictions.set(contradictionId, verificationRecord);

    // If contradiction verified at HIGH or VERY_HIGH, trigger rule evolution
    if (verification.approved && (verification.confidence === 'HIGH' || verification.confidence === 'VERY_HIGH')) {
      this.triggerRuleEvolution(contradiction, verificationRecord);
    }

    return {
      status: 'VERIFICATION_RECORDED',
      contradictionId: contradictionId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Trigger rule evolution when a contradiction is verified.
   * This creates new rules or updates existing rules based on findings.
   */
  triggerRuleEvolution(contradiction, verificationRecord) {
    const evolutionId = `EVO-${Date.now()}`;

    const evolution = {
      evolutionId: evolutionId,
      basedOnContradiction: contradiction.contradictionId,
      timestamp: new Date().toISOString(),
      newRules: this.inferNewRules(contradiction, verificationRecord),
      reason: `Verified finding: ${contradiction.description}`,
      jurisdiction: contradiction.jurisdiction || 'SA',
      applicableFrom: new Date().toISOString()
    };

    this.ruleEvolutionTracker.set(evolutionId, evolution);
    return evolution;
  }

  /**
   * Infer new rules from verified contradictions.
   * Uses the contradiction pattern to create matching rules.
   */
  inferNewRules(contradiction, verification) {
    const rules = [];

    // Create base rule from the verified contradiction
    const baseRule = {
      ruleId: `R-${Date.now()}`,
      type: contradiction.legalSignificance,
      pattern: contradiction.description,
      confidence: verification.confidence,
      jurisdiction: contradiction.jurisdiction || 'SA',
      reason: `Auto-generated from verified contradiction: ${contradiction.contradictionId}`,
      applicableFrom: new Date().toISOString()
    };
    rules.push(baseRule);

    // Create variant rules based on verification corrections
    if (verification.corrections && verification.corrections.length > 0) {
      verification.corrections.forEach((correction, idx) => {
        rules.push({
          ruleId: `R-${Date.now()}-var${idx}`,
          type: `${contradiction.legalSignificance}_variant`,
          pattern: `${contradiction.description} (variant: ${correction})`,
          confidence: verification.confidence,
          jurisdiction: contradiction.jurisdiction || 'SA',
          reason: `Variant from reviewer correction: ${correction}`,
          applicableFrom: new Date().toISOString()
        });
      });
    }

    return rules;
  }

  /**
   * Retrieve evolved rules for a specific jurisdiction.
   * These are sent back to devices for local engine improvement.
   */
  getRuleUpdatesForJurisdiction(jurisdiction, sinceTimestamp) {
    const applicableEvolutions = Array.from(this.ruleEvolutionTracker.values())
      .filter(e => e.jurisdiction === jurisdiction)
      .filter(e => new Date(e.timestamp) > new Date(sinceTimestamp));

    const allNewRules = applicableEvolutions.flatMap(e => e.newRules);

    return {
      ruleUpdatePacketId: `RUP-${Date.now()}`,
      jurisdiction: jurisdiction,
      timestamp: new Date().toISOString(),
      newRules: allNewRules,
      evolutionCount: applicableEvolutions.length,
      message: `${allNewRules.length} new rules available for ${jurisdiction}`
    };
  }

  /**
   * Get verification statistics for a jurisdiction.
   * Shows verification progress and rule evolution trends.
   */
  getVerificationStats(jurisdiction) {
    const packetsForJurisdiction = Array.from(this.feedbackQueue.values())
      .filter(p => p.jurisdiction === jurisdiction);

    const verifiedForJurisdiction = Array.from(this.verifiedContradictions.values())
      .filter(v => {
        const packet = this.feedbackQueue.get(v.sourcePacket);
        return packet && packet.jurisdiction === jurisdiction;
      });

    const evolutionsForJurisdiction = Array.from(this.ruleEvolutionTracker.values())
      .filter(e => e.jurisdiction === jurisdiction);

    const verificationRate = packetsForJurisdiction.length > 0
      ? (verifiedForJurisdiction.length / packetsForJurisdiction.length) * 100
      : 0;

    return {
      jurisdiction: jurisdiction,
      packetsPending: packetsForJurisdiction.filter(p => p.status === 'PENDING_REVIEW').length,
      packetsVerified: packetsForJurisdiction.filter(p => p.status === 'VERIFIED').length,
      contradictionsVerified: verifiedForJurisdiction.length,
      verificationRate: verificationRate.toFixed(1) + '%',
      rulesEvolved: evolutionsForJurisdiction.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Track contradiction evolution across multiple cases.
   * Shows patterns in how threats evolve (criminals adapt).
   */
  trackContradictionEvolution(baseContradictionPattern) {
    const allVerified = Array.from(this.verifiedContradictions.values());

    const variants = allVerified
      .filter(v => v.comments && v.comments.includes(baseContradictionPattern))
      .map(v => ({
        id: v.contradictionId,
        verified: v.verified,
        comments: v.comments
      }));

    return {
      basePattern: baseContradictionPattern,
      variantCount: variants.length,
      variants: variants,
      threatTrend: variants.length > 3 ? 'ESCALATING' : 'STABLE',
      recommendation: variants.length > 5 ? 'Escalate to rule evolution' : 'Monitor'
    };
  }

  // ---- Validation helpers ----

  validatePacket(packet) {
    return packet.packetId &&
           packet.caseReference &&
           packet.jurisdiction &&
           packet.deviceHash &&
           packet.constitutionVersion &&
           Array.isArray(packet.contradictions) &&
           packet.contradictions.length > 0;
  }

  getPacketErrors(packet) {
    const errors = [];
    if (!packet.packetId) errors.push('Missing packetId');
    if (!packet.caseReference) errors.push('Missing caseReference');
    if (!packet.jurisdiction) errors.push('Missing jurisdiction');
    if (!packet.deviceHash) errors.push('Missing deviceHash');
    if (!packet.contradictions || packet.contradictions.length === 0) {
      errors.push('No contradictions in packet');
    }
    return errors;
  }
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VerificationHub;
}
