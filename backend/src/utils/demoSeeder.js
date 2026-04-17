import { Claim } from "../models/Claim.js";
import { Patient } from "../models/Patient.js";
import { DEMO_CLAIMS, DEMO_PATIENTS } from "../data/demoData.js";

export async function ensureDemoData() {
  await Patient.bulkWrite(
    DEMO_PATIENTS.map((patient) => ({
      updateOne: {
        filter: { patientId: patient.patientId },
        update: { $setOnInsert: patient },
        upsert: true
      }
    })),
    { ordered: false }
  );

  const patients = await Patient.find().sort({ fullName: 1 });
  const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));

  await Claim.bulkWrite(
    DEMO_CLAIMS.map((claim) => {
      const patient = patientById.get(claim.patientId);
      if (!patient) {
        return null;
      }

      return {
        updateOne: {
          filter: { claimNumber: claim.claimNumber },
          update: {
            $setOnInsert: {
              ...claim,
              patient: patient._id,
              patientName: patient.fullName
            }
          },
          upsert: true
        }
      };
    }).filter(Boolean),
    { ordered: false }
  );

  return {
    patients: await Patient.find().sort({ fullName: 1 }),
    claims: await Claim.find().sort({ updatedAt: -1 })
  };
}

export function maskPatientForBilling(patient) {
  return {
    id: patient._id,
    patientId: patient.patientId,
    fullName: patient.fullName,
    dateOfBirth: patient.dateOfBirth,
    primaryDoctor: patient.primaryDoctor,
    insuranceProvider: patient.insuranceProvider,
    privacyLevel: patient.privacyLevel,
    billingProfile: patient.billingProfile,
    lastVisitAt: patient.lastVisitAt,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt
  };
}
