require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 
        'https://asset-verse-client-psi.vercel.app/'], 
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = process.env.DB_URI;

// Client Options
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});






// Verify Token Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};





async function run() {
  try {
    // Connect to MongoDB 
    
    console.log("Creating connection setup...");

    // Database & Collections
    const db = client.db("assetVerseDB");
    const usersCollection = db.collection("users");
    const assetsCollection = db.collection("assets");
    const requestsCollection = db.collection("requests");
    const affiliationCollection = db.collection("employeeAffiliations");

    // ---  API ROUTES WILL START HERE ---

    // 1. Basic  Route
    app.get('/', (req, res) => {
        res.send('AssetVerse Server is Running...');
    });

    // --- Auth Related APIs ---

    // 1. JWT 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
      .send({ success: true });
    });

    // 2. Logout 
    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
      .send({ success: true });
    });

    // 3. Create User  - HR & Employee Handling
    app.post('/users', async (req, res) => {
      const user = req.body;
      
      // Check if user already exists
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }

      // Base User Object
      let finalUser = {
        name: user.name,
        email: user.email,
        role: user.role,
        dateOfBirth: user.dateOfBirth, 
        profileImage: user.profileImage || "", 
        createdAt: new Date(),
      };

      // HR Specific Logic
      if (user.role === 'hr') {
        finalUser.companyName = user.companyName;
        finalUser.companyLogo = user.companyLogo;
        finalUser.packageLimit = 5; 
        finalUser.currentEmployees = 0; 
        finalUser.subscription = "basic"; 
      } 
      

      const result = await usersCollection.insertOne(finalUser);
      res.send(result);
    });
    
    // 4. Get User Role & Info (For Social Login Checks & Frontend Logic)
    app.get('/users/:email', async(req, res) =>{
        const email = req.params.email;
        const query = { email: email };
        const result = await usersCollection.findOne(query);
        res.send(result);
    })

    // --- Asset Management APIs ---

    // 1. Add Asset (HR Only)
    app.post('/assets', verifyToken, async (req, res) => {
      const asset = req.body;
      
      // Data preparation for MongoDB
      const newAsset = {
        productName: asset.productName,
        productImage: asset.productImage,
        productType: asset.productType, 
        productQuantity: parseInt(asset.productQuantity), 
        availableQuantity: parseInt(asset.productQuantity), 
        dateAdded: new Date(),
        hrEmail: asset.hrEmail,
        companyName: asset.companyName, 
      };

      const result = await assetsCollection.insertOne(newAsset);
      res.send(result);
    });

    // 2. Get Assets - COMPLEX PART
    app.get('/assets', verifyToken, async (req, res) => {
      const { email, search, type, limit, page } = req.query;
      
      
      let query = {};
      if (email) {
        query.hrEmail = email; 
      }

      // 2. Search Logic 
      if (search) {
        query.productName = { $regex: search, $options: 'i' }; 
      }

      // 3. Filter by Type
      if (type) {
        query.productType = type;
      }

      // 4. Pagination Logic
     
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const skip = (pageNumber - 1) * pageSize;

      // Fetch Data
     
      const result = await assetsCollection
        .find(query)
        .skip(skip)
        .limit(pageSize)
        .toArray();

      // Total count 
      const totalAssets = await assetsCollection.countDocuments(query);

      res.send({ 
        assets: result, 
        totalAssets, 
        totalPages: Math.ceil(totalAssets / pageSize) 
      });
    });

    // 3. Delete Asset 
    app.delete('/assets/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetsCollection.deleteOne(query);
      res.send(result);
    });

    // 4. Update Asset 
    app.get('/assets/:id', verifyToken, async(req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await assetsCollection.findOne(query);
        res.send(result);
    })

    app.patch('/assets/:id', verifyToken, async(req, res) => {
        const id = req.params.id;
        const item = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                productName: item.productName,
                productType: item.productType,
                productQuantity: parseInt(item.productQuantity),
               
            }
        }
        const result = await assetsCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    // --- Request & Auto-Affiliation APIs ---

    // 1. Employee Requests an Asset
    app.post('/requests', verifyToken, async (req, res) => {
      const request = req.body;
      
      // Default fields for a new request
      const newRequest = {
        ...request, // assetId, assetName, hrEmail, 
        requestDate: new Date(),
        requestStatus: 'pending',
        approvalDate: null,
      };

      const result = await requestsCollection.insertOne(newRequest);
      res.send(result);
    });

    // 2. Get Requests 
    app.get('/requests', verifyToken, async (req, res) => {
      const { email } = req.query; // HR Email
      const query = { hrEmail: email };
      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    // 3. Get Requests 
    app.get('/my-requests/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email }; 
      
      //
      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    
    app.patch('/requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body; 
      
      const filter = { _id: new ObjectId(id) };
      const request = await requestsCollection.findOne(filter);
      
      if (!request) {
          return res.status(404).send({ message: "Request not found" });
      }

      // If Rejected: Just update status 
      if (status === 'rejected') {
          const updateDoc = {
              $set: { requestStatus: 'rejected', approvalDate: new Date() }
          };
          const result = await requestsCollection.updateOne(filter, updateDoc);
          return res.send(result);
      }


      // If Approved: Check Limit First, then Process
      if (status === 'approved') {
          
          // ==================== NEW LIMIT CHECK LOGIC START ====================
        
          const hrUser = await usersCollection.findOne({ email: request.hrEmail });
          const limit = hrUser?.packageLimit || 5;

          
          const currentEmployees = await affiliationCollection.countDocuments({ hrEmail: request.hrEmail });

         
          const existingAffiliation = await affiliationCollection.findOne({
              employeeEmail: request.requesterEmail,
              hrEmail: request.hrEmail
          });

          
          if (!existingAffiliation && currentEmployees >= limit) {
              return res.send({ 
                  limitReached: true, 
                  message: "Package Limit Reached. Please Upgrade!" 
              });
          }
          // ==================== NEW LIMIT CHECK LOGIC END ====================


          //  Update Request Status
          const updateRequestDoc = {
              $set: { requestStatus: 'approved', approvalDate: new Date() }
          };
          await requestsCollection.updateOne(filter, updateRequestDoc);

          //  Reduce Asset Quantity
          const assetFilter = { _id: new ObjectId(request.assetId) };
          const updateAssetDoc = {
              $inc: { availableQuantity: -1 } 
          };
          await assetsCollection.updateOne(assetFilter, updateAssetDoc);

          //  Auto-Affiliation (Only if not already affiliated)
          if (!existingAffiliation) {
              const newAffiliation = {
                  employeeEmail: request.requesterEmail,
                  employeeName: request.requesterName,
                  hrEmail: request.hrEmail,
                  companyName: request.companyName,
                  companyLogo: request.companyLogo,
                  affiliationDate: new Date(),
                  role: "employee"
              };
              await affiliationCollection.insertOne(newAffiliation);
              
              
              await usersCollection.updateOne(
                  { email: request.hrEmail }, 
                  { $inc: { currentEmployees: 1 } }
              );
          }

          res.send({ success: true, message: "Request Approved and Processed" });
      }
    });

    // 5. Delete Request (Employee can cancel pending request)
    app.delete('/requests/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await requestsCollection.deleteOne(query);
        res.send(result);
    });


    // 4. Get Single Asset 
    app.get('/assets/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await assetsCollection.findOne(query);
        res.send(result);
    });

    // 5. Update Asset

    app.patch('/assets/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const item = req.body;
        const filter = { _id: new ObjectId(id) };
        
        const updatedDoc = {
            $set: {
                productName: item.productName,
                productType: item.productType,
                productQuantity: parseInt(item.productQuantity),
                
            }
        }
        const result = await assetsCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });



    // --- Team & Affiliation Management APIs ---


    app.get('/affiliates/:hrEmail', verifyToken, async (req, res) => {
      const hrEmail = req.params.hrEmail;
      const query = { hrEmail: hrEmail };
      const result = await affiliationCollection.find(query).toArray();
      res.send(result);
    });

    // 2. Check if User is Affiliated
    
    app.get('/my-affiliations/:email', verifyToken, async(req, res) => {
        const email = req.params.email;
        const query = { employeeEmail: email };
        const result = await affiliationCollection.find(query).toArray();
        res.send(result);
    })

    // 3. Remove Employee from Team 
    
    app.delete('/affiliates/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await affiliationCollection.deleteOne(query);
      res.send(result);
    });


    // --- Payment APIs ---

    // 1. Create Payment Intent 
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { price } = req.body;
      
      // Stripe expects amount in cents 
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      });
    });

    // 2. Save Payment Info & Update Package Limit 
    app.post('/payments', verifyToken, async (req, res) => {
        const payment = req.body;
        const paymentResult = await db.collection("payments").insertOne(payment);

        const filter = { email: payment.hrEmail };
        const updatedDoc = {
            $set: { 
                packageLimit: payment.newLimit,
                subscription: payment.packageName 
            }
        };
        const updateResult = await usersCollection.updateOne(filter, updatedDoc);

        res.send({ paymentResult, updateResult });
    });
    
    // 3. Admin/HR Stats 
    app.get('/admin-stats', verifyToken, async(req, res) => {
        // Example: Get simple counts
        const users = await usersCollection.estimatedDocumentCount();
        const assets = await assetsCollection.estimatedDocumentCount();
        res.send({ users, assets });
    });

    // --- HR Stats API  ---
    app.get('/hr-stats', verifyToken, async (req, res) => {
        const email = req.query.email;
        
        // 1. Pie Chart Data: Returnable vs Non-returnable Count
        const returnableCount = await assetsCollection.countDocuments({ 
            hrEmail: email, 
            productType: 'Returnable' 
        });
        const nonReturnableCount = await assetsCollection.countDocuments({ 
            hrEmail: email, 
            productType: 'Non-returnable' 
        });
        
        // 2. Bar Chart Data: Top 5 Most Requested Items
        const topRequests = await requestsCollection.aggregate([
            { $match: { hrEmail: email } }, 
            { $group: { _id: "$assetName", count: { $sum: 1 } } }, 
            { $sort: { count: -1 } }, 
            { $limit: 5 } 
        ]).toArray();

        res.send({
            pieData: [
                { name: 'Returnable', value: returnableCount },
                { name: 'Non-returnable', value: nonReturnableCount }
            ],
            barData: topRequests 
        });
    });

    // --- YOUR API ROUTES END HERE ---

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } finally {
    
    // await client.close(); 
  }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});