// API shape of every document: "_id" is exposed as "id"; Mongoose's "__v" and the password hash are dropped.
export const toJSON = {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
};
