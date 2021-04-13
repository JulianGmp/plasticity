#include <iostream>
#include <sstream>

#include "../include/SpaceItem.h"
#include "../include/Item.h"
#include "../include/Solid.h"
#include "../include/Mesh.h"
#include "../include/SpaceInstance.h"

Napi::Value cast(MbSpaceItem * _underlying, const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() != 1)
    {
        Napi::Error::New(env, "Expecting 1 parameters").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[0].IsNumber())
    {
        Napi::Error::New(env, "Parameter 0 must be number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    const uint isa = info[0].ToNumber().Uint32Value();
    if (_underlying->IsA() != isa && _underlying->Family() != isa)
    {
        std::ostringstream msg;
        msg << "Operation Cast failed: object is a " << _underlying->IsA() << "with family " << _underlying->Family() << " but trying to cast to " << isa << "\n";
        Napi::Error::New(env, msg.str()).ThrowAsJavaScriptException();
        return env.Undefined();
    }

    _underlying->AddRef();
    switch (isa)
    {
    // case st_Assembly:
    //     return Item::NewInstance(env, dynamic_cast<MbAssembly *>(_underlying));
    // case st_AssistedItem:
    //     return Item::NewInstance(env, dynamic_cast<MbAssistingItem´ *>(_underlying));
    // case st_Collection:
    //     return Item::´NewInstance(env, dynamic_cast<MbCollection *>(_underlying));
    // case st_Instance:
    //     return Item::NewInstance(env, dynamic_cast<MbInstance *>(_underlying));
    case st_Mesh:
        return Mesh::NewInstance(env, dynamic_cast<MbMesh *>(_underlying));
    // case st_PlaneInstance:
    //     return Item::NewInstance(env, dynamic_cast<MbPlaneInstance *>(_underlying));
    // case st_PointFrame:
    //     return Item::NewInstance(env, dynamic_cast<MbPointFrame *>(_underlying));
    case st_Solid:
        return Solid::NewInstance(env, dynamic_cast<MbSolid *>(_underlying));
    case st_SpaceInstance:
        return SpaceInstance::NewInstance(env, dynamic_cast<MbSpaceInstance *>(_underlying));
    case st_Curve3D:
        return Curve3D::NewInstance(env, dynamic_cast<MbCurve3D *>(_underlying));
        // case st_WireFrame:
        //     return Item::NewInstance(env, dynamic_cast<MbWireFrame *>(_underlying));
        // default:
        //     Napi::Error::New(env, "Invalid cast parameter").ThrowAsJavaScriptException();
        //     return env.Undefined();
    }
}

Napi::Value SpaceItem::Cast(const Napi::CallbackInfo &info)
{
    return cast(this->_underlying, info);
}

Napi::Value Item::Cast(const Napi::CallbackInfo &info)
{
    return cast(this->_underlying, info);
}