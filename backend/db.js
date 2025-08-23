import mongoose from 'mongoose';


const connectToDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log('connected to db successfully');
    }
    catch (error) {
        console.log('error connecting to db', error);
    }
};

export { connectToDB };
