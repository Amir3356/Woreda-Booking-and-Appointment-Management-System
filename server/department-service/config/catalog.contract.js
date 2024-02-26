// gRPC contract of the catalog API (woreda.catalog.v1.CatalogService), as a protobuf JSON descriptor.
// Served by department-service, called by appointment-service; both keep an identical copy.
// Field numbers are the wire format: never renumber or reuse them.
export const catalogContract = {
  nested: { woreda: { nested: { catalog: { nested: { v1: { nested: {
    CatalogService: {
      methods: { GetService: { requestType: "GetServiceRequest", responseType: "GetServiceResponse" } },
    },
    GetServiceRequest: { fields: { serviceId: { type: "string", id: 1 } } },
    GetServiceResponse: { fields: { service: { type: "Service", id: 1 }, department: { type: "Department", id: 2 } } },
    Service: {
      fields: {
        id: { type: "string", id: 1 }, departmentId: { type: "string", id: 2 }, code: { type: "string", id: 3 },
        name: { type: "string", id: 4 }, durationMinutes: { type: "int32", id: 5 }, dailyQuota: { type: "int32", id: 6 },
        requiredDocuments: { rule: "repeated", type: "string", id: 7 }, isActive: { type: "bool", id: 8 },
      },
    },
    Department: {
      fields: {
        id: { type: "string", id: 1 }, code: { type: "string", id: 2 }, name: { type: "string", id: 3 },
        buildingRoom: { type: "string", id: 4 }, contactPhone: { type: "string", id: 5 }, isActive: { type: "bool", id: 6 },
      },
    },
  } } } } } } },
};
