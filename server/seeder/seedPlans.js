const Plan = require("../models/Plan");

const plans = [
  {
    name: {
      en: "Free Package",
      es: "Paquete Gratis"
    },
    type: "free",
    monthly: {
      price: 0,
      priceMXN: 0,
    },
    limits: {  
      aiConsultations: 3,
      medicalReports: 10,  
      bookingDiscount: 0
    },
    benefits: {
      en: [
        "Access to 10 customer leads", 
        "Standard email support", 
        "Standard listing visibility"
      ],
      es: [
        "Acceso a 10 clientes potenciales", 
        "Soporte por correo electrónico estándar", 
        "Visibilidad de listado estándar"
      ]
    },
    isActive: true
  },
  {
    name: {
      en: "Premium Package",
      es: "Paquete Premium"
    },
    type: "premium",
    monthly: {
      price: 11.99,
      priceMXN: 225,
    },
    limits: {  
      aiConsultations: -1,
      medicalReports: -1,  
      bookingDiscount: 10
    },
    benefits: {
      en: [
        "Access to 100 customer leads",
        "Priority email support",
        "Enhanced listing visibility",
        "Access to performance analytics"
      ],
      es: [
        "Acceso a 100 clientes potenciales",
        "Soporte prioritario por correo electrónico",
        "Visibilidad mejorada del listado",
        "Acceso a análisis de rendimiento"
      ]
    },
    isActive: true
  },
];

const seedPlans = async () => {
  try {
    await Plan.insertMany(plans);
    console.log("Plans have been seeded");
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = seedPlans;

