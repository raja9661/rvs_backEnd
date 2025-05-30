const aboutus = require('../models/AboutUs');

exports.getAboutFormData = async(req,res) =>{
    try {
        //console.log (req.body)
        const {fullName,email,phone,company,subject,reason,message} = req.body
        const newaboutdata = new aboutus({fullName,email,phone,company,subject,reason,message});
        const data = newaboutdata.save()
        
         //const aboutdata = await aboutus.find({role:"aboutdata"});
         res.json(data);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
}